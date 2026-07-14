"""Motor nutricional local de FitControl Pro.

No usa IA, modelos, nube ni APIs externas. Emplea OpenCV clásico, Pillow,
segmentación por color y reglas editables del archivo perfiles_nutricionales.json.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import math
import os
import re
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

try:
    import cv2
    import numpy as np
    from PIL import Image, ImageOps, UnidentifiedImageError
except ImportError as exc:
    print("Faltan dependencias. Ejecute INSTALAR-MOTOR-LOCAL.bat.")
    raise SystemExit(2) from exc

HERE = Path(__file__).resolve().parent
DEFAULT_ROOT = HERE.parent
PROFILES = json.loads((HERE / "perfiles_nutricionales.json").read_text(encoding="utf-8"))
MAX_BODY = 14 * 1024 * 1024


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def decode_image(data_url: str) -> tuple[np.ndarray, Image.Image]:
    if not isinstance(data_url, str) or not data_url:
        raise ValueError("No se recibió una fotografía.")
    encoded = data_url.split(",", 1)[1] if "," in data_url else data_url
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError("La fotografía está codificada incorrectamente.") from exc
    if len(raw) > 10 * 1024 * 1024:
        raise ValueError("La fotografía supera 10 MB.")
    try:
        with Image.open(io.BytesIO(raw)) as source:
            pil = ImageOps.exif_transpose(source).convert("RGB")
            if pil.width < 120 or pil.height < 120:
                raise ValueError("La imagen es demasiado pequeña.")
            pil.thumbnail((1100, 1100), Image.Resampling.LANCZOS)
            pil = pil.copy()
    except UnidentifiedImageError as exc:
        raise ValueError("El archivo no es una imagen válida.") from exc
    rgb = np.asarray(pil)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), pil


def plate_mask(image: np.ndarray) -> tuple[np.ndarray, tuple[int, int, int] | None, bool]:
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (9, 9), 1.8)
    minimum = int(min(h, w) * 0.22)
    maximum = int(min(h, w) * 0.49)
    circles = cv2.HoughCircles(blur, cv2.HOUGH_GRADIENT, dp=1.25, minDist=min(h, w) * 0.35,
                               param1=100, param2=42, minRadius=minimum, maxRadius=maximum)
    chosen = None
    if circles is not None:
        cx, cy = w / 2, h / 2
        candidates = [tuple(map(int, c)) for c in np.round(circles[0])]
        candidates.sort(key=lambda c: math.hypot(c[0] - cx, c[1] - cy) - c[2] * 0.12)
        chosen = candidates[0]
    mask = np.zeros((h, w), dtype=np.uint8)
    if chosen:
        x, y, r = chosen
        cv2.circle(mask, (x, y), max(10, int(r * 0.91)), 255, -1)
        return mask, chosen, True
    center = (w // 2, h // 2)
    axes = (max(20, int(w * 0.40)), max(20, int(h * 0.40)))
    cv2.ellipse(mask, center, axes, 0, 0, 360, 255, -1)
    return mask, None, False


def color_features(image: np.ndarray, p_mask: np.ndarray) -> tuple[dict[str, float], np.ndarray, float]:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    plate = p_mask > 0
    # Retira plato claro y fondo muy oscuro. Conserva alimentos claros con algo de saturación o textura.
    likely_empty = ((s < 28) & (v > 210)) | (v < 18)
    food = plate & ~likely_empty
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    local_edges = cv2.Canny(gray, 55, 145) > 0
    food |= plate & local_edges & (v < 235)
    food_u8 = (food.astype(np.uint8) * 255)
    kernel = np.ones((5, 5), np.uint8)
    food_u8 = cv2.morphologyEx(food_u8, cv2.MORPH_OPEN, kernel)
    food_u8 = cv2.morphologyEx(food_u8, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    food = food_u8 > 0
    plate_pixels = max(1, int(plate.sum()))
    food_pixels = max(1, int(food.sum()))
    coverage = food_pixels / plate_pixels
    if coverage < 0.10:
        food = plate & (v < 225)
        food_u8 = (food.astype(np.uint8) * 255)
        food_pixels = max(1, int(food.sum()))
        coverage = food_pixels / plate_pixels

    def ratio(condition: np.ndarray) -> float:
        return float((condition & food).sum()) / food_pixels

    feats = {
        "green": ratio((h >= 34) & (h <= 92) & (s >= 45) & (v >= 35)),
        "red_orange": ratio(((h <= 20) | (h >= 170)) & (s >= 55) & (v >= 45)),
        "yellow_beige": ratio((h >= 15) & (h <= 38) & (s >= 24) & (v >= 65)),
        "brown": ratio((h >= 4) & (h <= 24) & (s >= 55) & (v >= 30) & (v <= 185)),
        "white": ratio((s <= 48) & (v >= 145)),
        "dark": ratio(v <= 78),
        "high_saturation": ratio(s >= 105),
        "brightness": float(v[food].mean() / 255.0) if food.any() else 0.5,
        "edge_density": float((local_edges & food).sum()) / food_pixels,
    }
    return feats, food_u8, clamp(coverage, 0.04, 1.0)


def keyword_adjustments(notes: str) -> dict[str, float]:
    n = notes.lower()
    groups = {
        "protein": ["pollo", "carne", "res", "cerdo", "pescado", "atún", "atun", "huevo", "queso", "frijol", "lenteja"],
        "carb": ["arroz", "pasta", "papa", "tortilla", "pan", "yuca", "plátano", "platano", "avena", "maíz", "maiz"],
        "veg": ["ensalada", "vegetal", "verdura", "brócoli", "brocoli", "lechuga", "tomate", "pepino"],
        "fruit": ["fruta", "manzana", "banano", "banana", "piña", "pina", "melón", "melon", "papaya"],
        "dessert": ["pastel", "postre", "galleta", "dulce", "helado", "chocolate"],
        "soup": ["sopa", "caldo", "guiso", "crema"],
    }
    result = {k: 0.0 for k in groups}
    for group, words in groups.items():
        result[group] = min(0.45, 0.18 * sum(1 for word in words if word in n))
    return result


def classify(feats: dict[str, float], coverage: float, notes: str) -> tuple[str, dict[str, float]]:
    kw = keyword_adjustments(notes)
    veg = feats["green"] * 1.15 + kw["veg"]
    carb = (feats["white"] * 0.52 + feats["yellow_beige"] * 0.78) + kw["carb"]
    protein = (feats["brown"] * 0.75 + feats["red_orange"] * 0.42 + feats["dark"] * 0.25) + kw["protein"]
    fruit = (feats["high_saturation"] * 0.42 + feats["red_orange"] * 0.38 + feats["yellow_beige"] * 0.20) + kw["fruit"]
    soup = (0.35 if feats["edge_density"] < 0.045 and coverage > 0.52 else 0.0) + kw["soup"]
    dessert = (0.20 if feats["green"] < 0.05 and feats["brightness"] > 0.55 and feats["brown"] + feats["white"] > 0.38 else 0.0) + kw["dessert"]
    scores = {"vegetables": veg, "carbohydrate": carb, "protein": protein, "fruit": fruit, "soup": soup, "dessert": dessert}
    ordered = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    strong = [name for name, score in ordered if score >= 0.26]
    if len(strong) >= 2 and ordered[1][1] >= ordered[0][1] * 0.52:
        category = "mixed"
    elif ordered[0][1] < 0.20:
        category = "mixed"
    else:
        category = ordered[0][0]
    shares = {"veg": max(0.04, veg), "carb": max(0.04, carb), "protein": max(0.04, protein)}
    total = sum(shares.values())
    shares = {k: v / total for k, v in shares.items()}
    return category, shares


def estimate_grams(category: str, coverage: float, diameter: float, portion: str) -> float:
    base = float(PROFILES[category]["base_grams"])
    area_factor = clamp((diameter / 26.0) ** 2, 0.45, 2.05)
    coverage_factor = clamp(0.52 + coverage * 1.15, 0.58, 1.55)
    portion_factor = {"small": 0.72, "medium": 1.0, "large": 1.32, "auto": 1.0}.get(portion, 1.0)
    return clamp(base * area_factor * coverage_factor * portion_factor, 80, 850)


def macro_estimate(category: str, shares: dict[str, float], grams: float, preparation: str) -> dict[str, float]:
    if category == "mixed":
        sources = {"veg": PROFILES["vegetables"], "carb": PROFILES["carbohydrate"], "protein": PROFILES["protein"]}
        per100 = {}
        for key in ("protein_100g", "carbs_100g", "fat_100g"):
            per100[key] = sum(shares[name] * sources[name][key] for name in shares)
    else:
        profile = PROFILES[category]
        per100 = {key: profile[key] for key in ("protein_100g", "carbs_100g", "fat_100g")}
    if preparation == "fried":
        per100["fat_100g"] += 5.5
        per100["carbs_100g"] += 2.0
    elif preparation == "grilled":
        per100["fat_100g"] += 1.0
    elif preparation == "steamed":
        per100["fat_100g"] = max(0.4, per100["fat_100g"] - 0.7)
    factor = grams / 100.0
    protein = per100["protein_100g"] * factor
    carbs = per100["carbs_100g"] * factor
    fat = per100["fat_100g"] * factor
    calories = protein * 4 + carbs * 4 + fat * 9
    return {"calories": calories, "protein": protein, "carbs": carbs, "fat": fat}


def components_from_features(feats: dict[str, float], shares: dict[str, float]) -> list[dict[str, str]]:
    items: list[tuple[float, str, str]] = []
    if feats["green"] > 0.06: items.append((feats["green"], "Zona verde", "posibles vegetales"))
    if feats["white"] + feats["yellow_beige"] > 0.10: items.append((feats["white"] + feats["yellow_beige"], "Zona clara/amarilla", "posible cereal o tubérculo"))
    if feats["brown"] + feats["red_orange"] + feats["dark"] > 0.10: items.append((feats["brown"] + feats["red_orange"] + feats["dark"], "Zona marrón/rojiza", "posible proteína, legumbre o salsa"))
    items.sort(reverse=True)
    return [{"name": name, "estimated_amount": f"{round(value*100)}% de los píxeles de alimento; {desc}"} for value, name, desc in items[:4]]


def preview_image(image: np.ndarray, p_mask: np.ndarray, food_mask: np.ndarray, circle: tuple[int, int, int] | None) -> str:
    overlay = image.copy()
    tint = np.zeros_like(image)
    tint[:, :, 1] = food_mask
    overlay = cv2.addWeighted(overlay, 0.78, tint, 0.28, 0)
    if circle:
        cv2.circle(overlay, (circle[0], circle[1]), int(circle[2] * 0.91), (80, 240, 180), 3)
    else:
        contours, _ = cv2.findContours(p_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(overlay, contours, -1, (80, 240, 180), 3)
    ok, encoded = cv2.imencode('.jpg', overlay, [int(cv2.IMWRITE_JPEG_QUALITY), 76])
    return "data:image/jpeg;base64," + base64.b64encode(encoded.tobytes()).decode("ascii") if ok else ""


def analyze(payload: dict[str, Any]) -> dict[str, Any]:
    image, pil = decode_image(str(payload.get("image_base64", "")))
    diameter = clamp(float(payload.get("plate_diameter_cm", 26) or 26), 15, 40)
    portion = str(payload.get("portion_size", "auto"))
    preparation = str(payload.get("preparation", "unknown"))
    notes = str(payload.get("notes", ""))[:800]
    p_mask, circle, plate_detected = plate_mask(image)
    feats, food_mask, coverage = color_features(image, p_mask)
    category, shares = classify(feats, coverage, notes)
    grams = estimate_grams(category, coverage, diameter, portion)
    macros = macro_estimate(category, shares, grams, preparation)
    quality = min(pil.width, pil.height) / 900.0
    confidence = 34 + (10 if plate_detected else 0) + clamp(quality, 0, 1) * 7 + (8 if notes.strip() else 0)
    if 0.18 <= coverage <= 0.82: confidence += 5
    confidence = clamp(confidence, 30, 67)
    label = PROFILES[category]["label"]
    prep_labels = {"unknown": "preparación no indicada", "steamed": "hervido o al vapor", "grilled": "asado o a la plancha", "fried": "frito o empanizado"}
    portion_desc = f"Aproximadamente {round(grams)} g visuales en un plato de {diameter:.0f} cm; cobertura estimada {coverage*100:.0f}%; {prep_labels.get(preparation, 'preparación no indicada')}."
    assumptions = [
        "El peso se infiere por cobertura y diámetro del plato; no se mide con báscula.",
        "Aceites, rellenos e ingredientes ocultos pueden cambiar mucho las calorías.",
        "Los colores no identifican un alimento exacto; el tipo de plato es una sugerencia por reglas.",
    ]
    return {
        "dish_name": label,
        "dish_type": label,
        "portion_description": portion_desc,
        "calories_kcal": round(macros["calories"]),
        "protein_g": round(macros["protein"], 1),
        "carbohydrates_g": round(macros["carbs"], 1),
        "fat_g": round(macros["fat"], 1),
        "confidence_percent": round(confidence),
        "components": components_from_features(feats, shares),
        "assumptions": assumptions,
        "method": "OpenCV clásico + reglas nutricionales locales",
        "ai_used": False,
        "internet_required": False,
        "estimated_grams": round(grams),
        "plate_detected": plate_detected,
        "coverage_percent": round(coverage * 100, 1),
        "segmentation_preview": preview_image(image, p_mask, food_mask, circle),
    }


class Handler(SimpleHTTPRequestHandler):
    server_version = "FitControlLocal/1.0"

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def json_response(self, status: int, data: dict[str, Any]) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] == "/health":
            self.json_response(200, {"status": "ok", "service": "Motor local FitControl", "ai_used": False, "internet_required": False})
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path.split("?", 1)[0] != "/analyze-meal-local":
            self.json_response(404, {"error": "Ruta no encontrada."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ValueError("La solicitud está vacía o supera el límite permitido.")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            self.json_response(200, analyze(payload))
        except (ValueError, json.JSONDecodeError) as exc:
            self.json_response(400, {"error": str(exc)})
        except Exception as exc:
            self.json_response(500, {"error": f"Error local: {exc.__class__.__name__}: {exc}"})


def main() -> None:
    parser = argparse.ArgumentParser(description="Servidor local de FitControl sin IA ni APIs externas")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--root", default=str(DEFAULT_ROOT))
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    os.chdir(root)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    url = f"http://127.0.0.1:{args.port}/index.html"
    print("=" * 68)
    print("FitControl Pro - motor nutricional LOCAL")
    print("Sin IA, sin claves, sin nube y sin APIs externas.")
    print(f"Abra: {url}")
    print("Para otro dispositivo en la misma red, use la IP de esta computadora.")
    print("Presione Ctrl+C para cerrar.")
    print("=" * 68)
    if not args.no_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nMotor local detenido.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
