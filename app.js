const DB_KEY='fitcontrol-pro-v1';
const defaultDB={strength:[],cardio:[],recovery:[],body:[],nutrition:[],meta:{seedVersion:0},settings:{name:'',age:'',height:'',goal:'fat_loss',targetWeight:'',weeklyGoal:4,calorieTarget:2200,proteinTarget:130,limitations:''}};
let db=loadDB();
applyInitialHistory();
let charts={};
let ocrParsed={};

const exerciseLibrary={
  Piernas:[['Extensión de piernas','Máquina de extensión'],['Prensa de piernas','Prensa inclinada'],['Curl femoral','Máquina de curl femoral'],['Abducción de piernas','Máquina abductora'],['Aducción de piernas','Máquina aductora'],['Elevación de talones','Máquina de pantorrilla'],['Estocadas','Mancuernas o peso corporal']],
  Pecho:[['Press de pecho','Máquina de press'],['Press inclinado','Mancuernas'],['Aperturas','Máquina contractor']],
  Espalda:[['Jalón al pecho','Polea alta'],['Remo sentado','Polea baja'],['Remo unilateral','Mancuerna'],['Hiperextensión lumbar','Banco romano']],
  Hombros:[['Press de hombros','Máquina de hombros'],['Elevaciones laterales','Mancuernas'],['Pájaros','Mancuernas']],
  Brazos:[['Curl de bíceps','Polea o mancuernas'],['Extensión de tríceps','Polea alta'],['Curl martillo','Mancuernas']],
  Core:[['Plancha','Colchoneta'],['Crunch abdominal','Máquina abdominal'],['Pallof press','Polea']],
  'Cuerpo completo':[['Sentadilla goblet','Mancuerna'],['Peso muerto con mancuernas','Mancuernas'],['Remo con sentadilla','Banda elástica']]
};

const exerciseGuides={
  'Extensión de piernas':['Ajusta el respaldo y alinea las rodillas con el eje de la máquina. Extiende sin bloquear las rodillas.','Cuádriceps'],
  'Prensa de piernas':['Apoya toda la espalda, coloca los pies al ancho de hombros y baja con control.','Piernas y glúteos'],
  'Curl femoral':['Alinea la rodilla con el pivote y flexiona sin levantar la cadera.','Isquiotibiales'],
  'Abducción de piernas':['Mantén la espalda apoyada y abre las piernas de forma controlada.','Glúteo medio'],
  'Aducción de piernas':['Cierra las piernas sin rebotes y conserva el tronco estable.','Aductores'],
  'Elevación de talones':['Sube los talones, pausa arriba y baja lentamente hasta sentir estiramiento.','Pantorrillas'],
  'Estocadas':['Da un paso estable, baja verticalmente y mantén la rodilla alineada con el pie.','Piernas y glúteos'],
  'Press de pecho':['Ajusta el asiento para que las empuñaduras queden a la altura del pecho y empuja sin bloquear codos.','Pecho y tríceps'],
  'Press inclinado':['Mantén los omóplatos apoyados y mueve las mancuernas sobre la parte alta del pecho.','Pecho superior'],
  'Aperturas':['Con codos ligeramente flexionados, junta los brazos sin encoger los hombros.','Pectorales'],
  'Jalón al pecho':['Lleva la barra hacia la parte alta del pecho y evita balancear el tronco.','Espalda'],
  'Remo sentado':['Tira hacia el abdomen con el pecho elevado y junta los omóplatos.','Espalda media'],
  'Remo unilateral':['Apoya una mano, mantén la espalda neutra y lleva el codo hacia la cadera.','Dorsal y espalda media'],
  'Hiperextensión lumbar':['Sube hasta alinear el cuerpo, sin arquear en exceso la zona lumbar.','Cadena posterior'],
  'Press de hombros':['Empuja hacia arriba manteniendo abdomen firme y hombros alejados de las orejas.','Hombros'],
  'Elevaciones laterales':['Eleva hasta la altura de los hombros con codos suaves y sin impulso.','Deltoides laterales'],
  'Pájaros':['Inclina el torso y abre los brazos manteniendo la espalda neutra.','Deltoides posteriores'],
  'Curl de bíceps':['Mantén los codos cerca del cuerpo y evita balancear el torso.','Bíceps'],
  'Extensión de tríceps':['Fija los codos al costado y extiende completamente con control.','Tríceps'],
  'Curl martillo':['Sujeta las mancuernas con palmas enfrentadas y mantén los codos quietos.','Bíceps y antebrazo'],
  'Plancha':['Alinea hombros, cadera y talones; aprieta abdomen y glúteos.','Core'],
  'Crunch abdominal':['Flexiona el tronco desde el abdomen, sin tirar del cuello.','Abdomen'],
  'Pallof press':['Resiste la rotación de la polea y mantén el tronco completamente estable.','Core antirotación'],
  'Sentadilla goblet':['Sostén la mancuerna frente al pecho, baja con rodillas alineadas y espalda neutra.','Piernas y glúteos'],
  'Peso muerto con mancuernas':['Lleva la cadera hacia atrás con espalda neutra y mancuernas cerca de las piernas.','Cadena posterior'],
  'Remo con sentadilla':['Mantén tensión en la banda durante la sentadilla y el remo.','Cuerpo completo'],
  'Caminata o bicicleta':['Mantén un ritmo cómodo en el que puedas hablar y controla la respiración.','Recuperación cardiovascular'],
  'Movilidad general':['Realiza movimientos lentos y amplios, sin forzar rangos dolorosos.','Movilidad'],
  'Core ligero':['Mantén tensión abdominal moderada y detén la serie si pierdes la postura.','Core']
};

function exerciseAsset(name){
 const slug=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
 return `assets/exercises/${slug}.svg`;
}

function loadDB(){try{return {...defaultDB,...JSON.parse(localStorage.getItem(DB_KEY)||'{}'),settings:{...defaultDB.settings,...(JSON.parse(localStorage.getItem(DB_KEY)||'{}').settings||{})}}}catch{return structuredClone(defaultDB)}}
function saveDB(){localStorage.setItem(DB_KEY,JSON.stringify(db));renderAll()}
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function nowLocal(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
function today(){return new Date().toISOString().slice(0,10)}
function fmtDate(v){return new Intl.DateTimeFormat('es-GT',{dateStyle:'medium',timeStyle:v?.includes('T')?'short':undefined}).format(new Date(v))}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2500)}
function num(v){return Number(v)||0}
function daysAgo(n){const d=new Date();d.setDate(d.getDate()-n);return d}
function within(date,n){return new Date(date)>=daysAgo(n)}
function applyInitialHistory(){
 db.strength=db.strength||[];db.cardio=db.cardio||[];db.recovery=db.recovery||[];db.body=db.body||[];db.nutrition=db.nutrition||[];db.meta=db.meta||{seedVersion:0};db.settings={...defaultDB.settings,...(db.settings||{})};
 if((db.meta.seedVersion||0)>=2)return;
 const strength=[
  {id:'hist-20260630-leg-extension',date:'2026-06-30T18:00',muscle:'Piernas',exercise:'Extensión de piernas',equipment:'Máquina de extensión',weight:0,sets:4,reps:15,duration:0,rpe:7,notes:'Historial previo. Peso no informado.'},
  {id:'hist-20260630-calf-raise',date:'2026-06-30T18:20',muscle:'Piernas',exercise:'Elevación de talones',equipment:'Máquina de pantorrilla',weight:0,sets:4,reps:15,duration:0,rpe:7,notes:'Rango informado de 15–20 repeticiones; se registra el mínimo.'},
  {id:'hist-20260630-abduction',date:'2026-06-30T18:35',muscle:'Piernas',exercise:'Abducción de piernas',equipment:'Máquina abductora',weight:0,sets:4,reps:15,duration:0,rpe:7,notes:'Rango informado de 15–20 repeticiones; se registra el mínimo.'},
  {id:'hist-20260630-lunges',date:'2026-06-30T18:50',muscle:'Piernas',exercise:'Estocadas',equipment:'Peso corporal o mancuernas',weight:0,sets:3,reps:15,duration:0,rpe:7,notes:'15 repeticiones por pierna.'},
  {id:'hist-20260630-plank',date:'2026-06-30T19:05',muscle:'Core',exercise:'Plancha',equipment:'Colchoneta',weight:0,sets:4,reps:1,duration:0,rpe:7,notes:'4 planchas; duración no informada.'},

  {id:'hist-20260629-pecfly',date:'2026-06-29T07:00',muscle:'Pecho',exercise:'Aperturas de pecho / Pec Deck',equipment:'Máquina contractor',weight:0,sets:4,reps:15,duration:0,rpe:7,notes:'4 planchas.'},
  {id:'hist-20260629-cable-down',date:'2026-06-29T07:15',muscle:'Pecho',exercise:'Cruce o extensión en polea alta',equipment:'Polea alta',weight:0,sets:4,reps:15,duration:0,rpe:7,notes:'Movimiento de arriba hacia abajo hasta el pecho; 2 planchas.'},
  {id:'hist-20260629-bar-chest',date:'2026-06-29T07:30',muscle:'Pecho',exercise:'Remo vertical con barra al pecho',equipment:'Barra de 15 kg',weight:15,sets:4,reps:15,duration:0,rpe:7,notes:'Codos abiertos; sin sobrepasar el cuello.'},
  {id:'hist-20260629-pullover',date:'2026-06-29T07:45',muscle:'Pecho',exercise:'Pullover con barra',equipment:'Banco y barra',weight:10,sets:4,reps:15,duration:0,rpe:7,notes:'Barra detrás de la cabeza.'},
  {id:'hist-20260629-inclinepress',date:'2026-06-29T08:00',muscle:'Pecho',exercise:'Press inclinado con barra',equipment:'Banco inclinado',weight:0,sets:4,reps:8,duration:0,rpe:8,notes:'Carga exacta no informada.'},
  {id:'hist-20260629-machines',date:'2026-06-29T08:15',muscle:'Pecho',exercise:'Press en máquinas adicionales',equipment:'Máquinas de pecho',weight:0,sets:8,reps:12,duration:0,rpe:7,notes:'Dos máquinas, 4 series de 12 en cada una.'},

  {id:'hist-20260701-seated-row',date:'2026-07-01T07:00',muscle:'Espalda',exercise:'Remo sentado con barra',equipment:'Polea baja',weight:15,sets:4,reps:15,duration:0,rpe:7,notes:'4 planchas más barra de 15 kg.'},
  {id:'hist-20260701-upright-bar',date:'2026-07-01T07:15',muscle:'Hombros',exercise:'Remo vertical con barra',equipment:'Barra de 15 kg',weight:15,sets:4,reps:15,duration:0,rpe:7,notes:'De cintura a pecho sin levantar hombros.'},
  {id:'hist-20260701-onearm-row',date:'2026-07-01T07:30',muscle:'Espalda',exercise:'Remo unilateral',equipment:'Mancuerna',weight:10,sets:4,reps:10,duration:0,rpe:7,notes:'10 kg; apoyo en banca.'},
  {id:'hist-20260701-concentration-curl',date:'2026-07-01T07:45',muscle:'Brazos',exercise:'Curl de concentración',equipment:'Mancuerna',weight:7.5,sets:4,reps:10,duration:0,rpe:7,notes:'Codo cerca de cara interna de rodilla.'},
  {id:'hist-20260701-bench-cable-row',date:'2026-07-01T08:00',muscle:'Espalda',exercise:'Jalón/remo en polea desde banca',equipment:'Polea con barra',weight:0,sets:4,reps:10,duration:0,rpe:7,notes:'7 planchas.'},
  {id:'hist-20260701-db-curl',date:'2026-07-01T08:15',muscle:'Brazos',exercise:'Curl simultáneo con mancuernas',equipment:'Mancuernas',weight:7.5,sets:4,reps:10,duration:0,rpe:7,notes:'7.5 kg por mancuerna.'},
  {id:'hist-20260701-straightarm',date:'2026-07-01T08:30',muscle:'Espalda',exercise:'Jalón con brazos rectos',equipment:'Polea alta',weight:0,sets:4,reps:15,duration:0,rpe:7,notes:'4 planchas; combinado con curl en polea.'},

  {id:'hist-20260706-squat10',date:'2026-07-06T07:00',muscle:'Piernas',exercise:'Sentadilla con barra',equipment:'Barra',weight:10,sets:1,reps:20,duration:0,rpe:7,notes:'Primera serie de activación.'},
  {id:'hist-20260706-legpress',date:'2026-07-06T07:10',muscle:'Piernas',exercise:'Prensa de piernas',equipment:'Prensa inclinada',weight:59.9,sets:4,reps:10,duration:0,rpe:8,notes:'4 discos de 33 lb = 132 lb aproximadas.'},
  {id:'hist-20260706-squat20',date:'2026-07-06T07:25',muscle:'Piernas',exercise:'Sentadilla con barra',equipment:'Barra',weight:20,sets:1,reps:20,duration:0,rpe:7,notes:'Serie adicional.'},
  {id:'hist-20260706-sumo',date:'2026-07-06T07:35',muscle:'Piernas',exercise:'Sentadilla sumo en máquina',equipment:'Máquina/polea',weight:29.9,sets:4,reps:10,duration:0,rpe:8,notes:'33 lb por lado = 66 lb aproximadas.'},
  {id:'hist-20260706-legext',date:'2026-07-06T07:50',muscle:'Piernas',exercise:'Extensión de piernas',equipment:'Máquina de extensión',weight:0,sets:4,reps:15,duration:0,rpe:7,notes:'4 planchas.'},
  {id:'hist-20260706-calf-standing',date:'2026-07-06T08:05',muscle:'Piernas',exercise:'Pantorrilla de pie',equipment:'Máquina de pantorrilla',weight:0,sets:3,reps:20,duration:0,rpe:7,notes:'7 planchas.'},
  {id:'hist-20260706-calf-seated',date:'2026-07-06T08:15',muscle:'Piernas',exercise:'Pantorrilla sentado',equipment:'Máquina de pantorrilla',weight:59.9,sets:3,reps:20,duration:0,rpe:8,notes:'Dos discos de 33 lb por lado, 132 lb aproximadas.'},
  {id:'hist-20260706-adduct',date:'2026-07-06T08:25',muscle:'Piernas',exercise:'Aducción de piernas',equipment:'Máquina aductora',weight:0,sets:4,reps:20,duration:0,rpe:7,notes:'6 planchas.'},
  {id:'hist-20260706-abduct',date:'2026-07-06T08:35',muscle:'Piernas',exercise:'Abducción de piernas',equipment:'Máquina abductora',weight:0,sets:4,reps:20,duration:0,rpe:7,notes:'6 planchas.'},

  {id:'hist-20260707-pecdeck',date:'2026-07-07T12:00',muscle:'Pecho',exercise:'Aperturas de pecho / Pec Deck',equipment:'Máquina contractor',weight:0,sets:4,reps:10,duration:0,rpe:7,notes:'4 planchas.'},
  {id:'hist-20260707-leverpress',date:'2026-07-07T12:15',muscle:'Pecho',exercise:'Press de pecho en máquina de palanca',equipment:'Máquina de discos',weight:20,sets:4,reps:15,duration:0,rpe:7,notes:'22 lb por lado, 44 lb externas totales.'},
  {id:'hist-20260707-inclinebar',date:'2026-07-07T12:30',muscle:'Pecho',exercise:'Press de banca inclinado',equipment:'Barra sola',weight:0,sets:4,reps:10,duration:0,rpe:7,notes:'Peso de barra no confirmado.'},
  {id:'hist-20260707-seatedpress3',date:'2026-07-07T12:45',muscle:'Pecho',exercise:'Press de pecho sentado',equipment:'Máquina de pecho',weight:0,sets:4,reps:10,duration:0,rpe:7,notes:'3 planchas.'},
  {id:'hist-20260707-seatedpress7',date:'2026-07-07T13:00',muscle:'Pecho',exercise:'Press sentado en máquina',equipment:'Máquina de pecho',weight:0,sets:4,reps:15,duration:0,rpe:8,notes:'7 planchas.'},
  {id:'hist-20260707-overheadplate',date:'2026-07-07T13:15',muscle:'Hombros',exercise:'Levantamiento de disco sobre la cabeza',equipment:'Disco',weight:10,sets:4,reps:15,duration:0,rpe:7,notes:'Disco de 22 lb.'},
  {id:'hist-20260707-lateralraise',date:'2026-07-07T13:30',muscle:'Hombros',exercise:'Elevaciones laterales',equipment:'Mancuernas',weight:5,sets:3,reps:10,duration:0,rpe:7,notes:'5 kg por mancuerna.'},

  {id:'hist-20260708-fixedpulldown',date:'2026-07-08T07:00',muscle:'Espalda',exercise:'Fixed Pulldown / Jalón fijo',equipment:'Máquina de jalón',weight:0,sets:4,reps:15,duration:0,rpe:7,notes:'Carga no informada.'},
  {id:'hist-20260708-vrow',date:'2026-07-08T07:15',muscle:'Espalda',exercise:'Remo sentado con agarre V',equipment:'Polea baja',weight:0,sets:3,reps:15,duration:0,rpe:7,notes:'Carga no informada.'},
  {id:'hist-20260708-latbar',date:'2026-07-08T07:30',muscle:'Espalda',exercise:'Jalón al pecho con barra larga',equipment:'Polea alta',weight:0,sets:4,reps:15,duration:0,rpe:7,notes:'7 planchas.'},
  {id:'hist-20260708-bicepsmachine',date:'2026-07-08T07:45',muscle:'Brazos',exercise:'Curl de bíceps en máquina',equipment:'Hammer Strength',weight:0,sets:3,reps:15,duration:0,rpe:7,notes:'4 planchas.'},
  {id:'hist-20260708-dbcurl',date:'2026-07-08T08:00',muscle:'Brazos',exercise:'Curl con palmas al frente',equipment:'Mancuernas',weight:5,sets:3,reps:15,duration:0,rpe:7,notes:'5 kg por mancuerna.'},
  {id:'hist-20260708-hammer',date:'2026-07-08T08:10',muscle:'Brazos',exercise:'Curl martillo',equipment:'Mancuernas',weight:5,sets:3,reps:15,duration:0,rpe:7,notes:'5 kg por mancuerna.'},
  {id:'hist-20260708-21s',date:'2026-07-08T08:25',muscle:'Brazos',exercise:'Curl 21s',equipment:'Barra fija',weight:10,sets:3,reps:21,duration:0,rpe:8,notes:'7 abajo a cadera + 7 cadera a pecho + 7 recorrido completo.'},

  {id:'hist-20260709-smith',date:'2026-07-09T08:00',muscle:'Piernas',exercise:'Sentadilla / prensa guiada en Smith',equipment:'Máquina Smith',weight:59.9,sets:4,reps:15,duration:0,rpe:8,notes:'4 discos de 33 lb = 132 lb externas, sin contar la máquina.'},
  {id:'hist-20260709-legcurl',date:'2026-07-09T08:20',muscle:'Piernas',exercise:'Curl femoral sentado',equipment:'Seated Leg Curl',weight:0,sets:4,reps:15,duration:0,rpe:7,notes:'7 planchas.'},
  {id:'hist-20260709-abduct',date:'2026-07-09T08:35',muscle:'Piernas',exercise:'Abducción de piernas',equipment:'Máquina abductora',weight:0,sets:4,reps:20,duration:0,rpe:8,notes:'9 planchas, abriendo piernas.'},
  {id:'hist-20260709-adduct',date:'2026-07-09T08:50',muscle:'Piernas',exercise:'Aducción de piernas',equipment:'Máquina aductora',weight:0,sets:4,reps:20,duration:0,rpe:8,notes:'9 planchas, cerrando piernas.'},
  {id:'hist-20260709-hipthrust',date:'2026-07-09T09:05',muscle:'Piernas',exercise:'Hip thrust / Empuje de cadera',equipment:'Máquina de hip thrust',weight:29.9,sets:4,reps:15,duration:0,rpe:8,notes:'2 discos de 33 lb = 66 lb externas.'},

  {id:'hist-20260710-overheadtriceps',date:'2026-07-10T06:00',muscle:'Brazos',exercise:'Extensión de tríceps sobre la cabeza',equipment:'Barra',weight:10,sets:4,reps:15,duration:0,rpe:7,notes:'Barra detrás de la cabeza; codos orientados hacia arriba.'},
  {id:'hist-20260710-reardelt',date:'2026-07-10T06:15',muscle:'Hombros',exercise:'Pectoral Fly / Rear Deltoid',equipment:'Máquina combinada',weight:0,sets:4,reps:15,duration:0,rpe:7,notes:'6 planchas; codos ligeramente flexionados.'},
  {id:'hist-20260710-inclineplatepress',date:'2026-07-10T06:30',muscle:'Pecho',exercise:'Press inclinado en máquina',equipment:'Máquina de discos',weight:20,sets:4,reps:10,duration:0,rpe:7,notes:'2 discos de 11 lb por lado = 44 lb externas.'},
  {id:'hist-20260710-ropepushdown',date:'2026-07-10T06:45',muscle:'Brazos',exercise:'Extensión de tríceps con cuerda',equipment:'Polea alta con cuerda',weight:0,sets:4,reps:15,duration:0,rpe:7,notes:'De pecho a cadera; carga exacta no informada.'},
  {id:'hist-20260710-convergentpress',date:'2026-07-10T07:00',muscle:'Pecho',exercise:'Press de pecho convergente',equipment:'Máquina de discos',weight:20,sets:4,reps:8,duration:0,rpe:8,notes:'2 discos de 11 lb por lado = 44 lb externas.'},
  {id:'hist-20260710-bar15',date:'2026-07-10T07:10',muscle:'Brazos',exercise:'Curl / remo con barra al pecho',equipment:'Barra',weight:15,sets:4,reps:15,duration:0,rpe:7,notes:'Codos hacia afuera; descripción registrada por el usuario.'}
 ];
 const cardio=[
  {id:'cardio-20260624-swim',date:'2026-06-24T07:00',type:'Natación',machine:'Piscina 50 m',duration:15.98,distance:0.50,calories:120,pace:'3:11/100 m',heartRate:137,rpe:6,notes:'500 m, 10 vueltas, 88 kcal activas.'},
  {id:'cardio-20260629-treadmill',date:'2026-06-29T08:45',type:'Caminadora',machine:'Caminadora',duration:15.6,distance:0.96,calories:122,pace:'16:15/km',heartRate:124,rpe:5,notes:'91 kcal activas; cadencia 80 ppm.'},
  {id:'cardio-20260629-swim',date:'2026-06-29T18:00',type:'Natación',machine:'Piscina 50 m',duration:15.33,distance:0.50,calories:147,pace:'3:04/100 m',heartRate:138,rpe:5,notes:'10 vueltas. 50 m pecho, 50 m mixto, 400 m libre; 117 kcal activas.'},
  {id:'cardio-20260701-treadmill',date:'2026-07-01T08:45',type:'Caminadora',machine:'Caminadora',duration:12.43,distance:0.945,calories:106,pace:'13:09/km',heartRate:132,rpe:5,notes:'81 kcal activas; cadencia 95 ppm.'},
  {id:'cardio-20260701-swim',date:'2026-07-01T18:00',type:'Natación',machine:'Piscina 50 m',duration:16.02,distance:0.65,calories:159,pace:'2:28/100 m',heartRate:131,rpe:7,notes:'13 vueltas: 50 m tabla, 100 m pecho, 500 m libre; 127 kcal activas.'},
  {id:'cardio-20260706-elliptical',date:'2026-07-06T09:00',type:'Elíptica',machine:'Elíptica',duration:12.88,distance:0,calories:127,pace:'',heartRate:141,rpe:7,notes:'102 kcal activas.'},
  {id:'cardio-20260706-swim',date:'2026-07-06T18:00',type:'Natación',machine:'Piscina 50 m',duration:17.57,distance:0.70,calories:144,pace:'2:30/100 m',heartRate:132,rpe:7,notes:'14 vueltas: 50 m mixto, 50 m pecho, 600 m libre; 109 kcal activas.'},
  {id:'cardio-20260707-swim',date:'2026-07-07T11:05',type:'Natación',machine:'Piscina 50 m',duration:23.98,distance:0.70,calories:189,pace:'3:25/100 m',heartRate:124,rpe:7,notes:'14 vueltas: 50 m dorso, 50 m mixto, 50 m pecho, 550 m libre; 142 kcal activas.'},
  {id:'cardio-20260710-swim',date:'2026-07-10T06:38',type:'Natación',machine:'Piscina 50 m',duration:17.23,distance:0.65,calories:165,pace:'2:51/100 m',heartRate:130,rpe:7,notes:'13 vueltas: 50 m tabla, 50 m dorso, 550 m libre; 132 kcal activas.'}
 ];
 const recovery=[
  {id:'recovery-20260709-sauna',date:'2026-07-09T07:00',type:'Sauna',duration:60,feeling:7,water:1000,notes:'Hora completa utilizada en bloques con descansos e hidratación; actividad semanal de recuperación.'}
 ];
 const body=[
  {id:'body-20260701',date:'2026-07-01',weight:91.53,waist:108.0,chest:104.0,hips:106.7,arm:34.75,thigh:61.0,bodyFat:32.6,notes:'Peso 201.8 lb. Cuello 41.7; hombros 126.5; brazo izq 34.5, der 35.0; antebrazo izq 17.6, der 17.2; abdomen sup 102.0, inf 102.5; muslo izq 61.5, der 60.5; pantorrilla izq 35.5, der 36.0. IMC 32.8; grasa visceral 20.5; agua 50.1%; BMR 1775 kcal.'},
  {id:'body-20260702',date:'2026-07-02',weight:91.53,waist:106.0,chest:104.0,hips:106.7,arm:34.75,thigh:61.0,bodyFat:32.6,notes:'Actualización intermedia: cintura 106.0 cm.'},
  {id:'body-20260709',date:'2026-07-09',weight:90.72,waist:105.5,chest:104.8,hips:107.5,arm:34.5,thigh:61.75,bodyFat:0,notes:'Peso 200.0 lb. Cuello 44.3; hombros 122.8; brazo izq/der 34.5; antebrazo izq 17.5, der 18.0; abdomen sup 101.2, inf 101.5; muslo izq 62.5, der 61.0; pantorrilla izq 38.2, der 40.0.'}
 ];
 const add=(arr,items)=>items.forEach(x=>{if(!arr.some(y=>y.id===x.id))arr.push(x)});
 add(db.strength,strength);add(db.cardio,cardio);add(db.recovery,recovery);add(db.body,body);
 db.strength.sort((a,b)=>new Date(a.date)-new Date(b.date));db.cardio.sort((a,b)=>new Date(a.date)-new Date(b.date));db.recovery.sort((a,b)=>new Date(a.date)-new Date(b.date));db.body.sort((a,b)=>new Date(a.date)-new Date(b.date));
 if(!db.settings.name)db.settings.name='Renato A Cruz';if(!db.settings.age)db.settings.age=37;if(!db.settings.height)db.settings.height=167;if(!db.settings.targetWeight)db.settings.targetWeight=83.7;if(!db.settings.weeklyGoal)db.settings.weeklyGoal=5;if(!db.settings.calorieTarget)db.settings.calorieTarget=2200;if(!db.settings.proteinTarget)db.settings.proteinTarget=140;
 db.meta.seedVersion=2;localStorage.setItem(DB_KEY,JSON.stringify(db));
}

function init(){
 document.getElementById('todayLabel').textContent=new Intl.DateTimeFormat('es-GT',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date());
 ['strengthDate','cardioDate','recoveryDate','mealDate'].forEach(id=>document.getElementById(id).value=nowLocal());document.getElementById('bodyDate').value=today();
 buildDatalists();bindNavigation();bindForms();bindOCR();bindDataControls();renderAll();
}
function bindNavigation(){document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>showView(b.dataset.view));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));document.getElementById('quickWorkoutBtn').onclick=()=>showView('workouts');document.getElementById('menuBtn').onclick=()=>document.getElementById('sidebar').classList.toggle('open')}
function showView(name){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===name));document.getElementById(name+'View').classList.add('active');document.getElementById('pageTitle').textContent=document.querySelector(`[data-view="${name}"]`)?.textContent.replace(/^\S+\s/,'')||'FitControl Pro';document.getElementById('sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}
function buildDatalists(){const ex=document.getElementById('exerciseOptions'),eq=document.getElementById('equipmentOptions');Object.values(exerciseLibrary).flat().forEach(([a,b])=>{ex.insertAdjacentHTML('beforeend',`<option value="${a}">`);eq.insertAdjacentHTML('beforeend',`<option value="${b}">`)})}

function bindForms(){
 document.getElementById('rpe').oninput=e=>document.getElementById('rpeValue').value=e.target.value;document.getElementById('cardioRpe').oninput=e=>document.getElementById('cardioRpeValue').value=e.target.value;
 document.getElementById('muscleGroup').onchange=e=>{const first=exerciseLibrary[e.target.value][0];document.getElementById('exerciseName').value=first[0];document.getElementById('equipment').value=first[1]};
 document.getElementById('strengthForm').onsubmit=e=>{e.preventDefault();db.strength.push({id:uid(),date:strengthDate.value,muscle:muscleGroup.value,exercise:exerciseName.value,equipment:equipment.value,weight:num(machineWeight.value),sets:num(sets.value),reps:num(reps.value),duration:num(strengthDuration.value),rpe:num(rpe.value),notes:strengthNotes.value});e.target.reset();strengthDate.value=nowLocal();sets.value=4;reps.value=15;strengthDuration.value=20;rpe.value=7;rpeValue.value=7;saveDB();toast('Ejercicio guardado')};
 document.getElementById('cardioForm').onsubmit=e=>{e.preventDefault();db.cardio.push({id:uid(),date:cardioDate.value,type:cardioType.value,machine:cardioMachine.value,duration:num(cardioDuration.value),distance:num(cardioDistance.value),calories:num(cardioCalories.value),pace:cardioPace.value,heartRate:num(heartRate.value),rpe:num(cardioRpe.value),notes:cardioNotes.value});e.target.reset();cardioDate.value=nowLocal();cardioRpe.value=6;cardioRpeValue.value=6;saveDB();toast('Cardio guardado')};
 document.getElementById('recoveryFeeling').oninput=e=>document.getElementById('recoveryFeelingValue').value=e.target.value;
 document.getElementById('recoveryForm').onsubmit=e=>{e.preventDefault();db.recovery.push({id:uid(),date:recoveryDate.value,type:recoveryType.value,duration:num(recoveryDuration.value),feeling:num(recoveryFeeling.value),water:num(recoveryWater.value),notes:recoveryNotes.value});e.target.reset();recoveryDate.value=nowLocal();recoveryFeeling.value=7;recoveryFeelingValue.value=7;saveDB();toast('Actividad de recuperación guardada')};
 document.getElementById('bodyForm').onsubmit=e=>{e.preventDefault();db.body.push({id:uid(),date:bodyDate.value,weight:num(bodyWeight.value),waist:num(waist.value),chest:num(chest.value),hips:num(hips.value),arm:num(arm.value),thigh:num(thigh.value),bodyFat:num(bodyFat.value),notes:bodyNotes.value});db.body.sort((a,b)=>new Date(a.date)-new Date(b.date));e.target.reset();bodyDate.value=today();saveDB();toast('Medidas guardadas')};
 document.getElementById('nutritionForm').onsubmit=e=>{e.preventDefault();db.nutrition.push({id:uid(),date:mealDate.value,type:mealType.value,name:mealName.value,calories:num(mealCalories.value),protein:num(mealProtein.value),carbs:num(mealCarbs.value),fat:num(mealFat.value),water:num(mealWater.value)});e.target.reset();mealDate.value=nowLocal();saveDB();toast('Comida guardada')};
 document.getElementById('settingsForm').onsubmit=e=>{e.preventDefault();db.settings={name:profileName.value,age:num(profileAge.value),height:num(profileHeight.value),goal:profileGoal.value,targetWeight:num(targetWeight.value),weeklyGoal:num(weeklyGoal.value)||4,calorieTarget:num(calorieTarget.value),proteinTarget:num(proteinTarget.value),limitations:limitations.value};saveDB();toast('Configuración guardada')};
 document.getElementById('refreshPlanBtn').onclick=()=>renderPlanner(Math.floor(Math.random()*3));document.getElementById('projectionRange').onchange=renderCharts;document.getElementById('exerciseCompareSelect').onchange=renderExerciseChart;document.getElementById('historyType').onchange=renderHistory;document.getElementById('historySearch').oninput=renderHistory;
}

function bindOCR(){const input=document.getElementById('screenshotInput'),preview=document.getElementById('screenshotPreview'),scan=document.getElementById('scanScreenshotBtn');input.onchange=()=>{const f=input.files[0];if(!f)return;preview.src=URL.createObjectURL(f);preview.classList.remove('hidden');scan.disabled=false};scan.onclick=async()=>{const f=input.files[0];if(!f)return;const status=document.getElementById('ocrStatus');status.classList.remove('hidden');status.textContent='Analizando imagen…';scan.disabled=true;try{const result=await Tesseract.recognize(f,'spa+eng',{logger:m=>{if(m.status==='recognizing text')status.textContent=`Analizando imagen… ${Math.round(m.progress*100)}%`}});const text=result.data.text;ocrParsed=parseCardioText(text);document.getElementById('ocrRawText').textContent=text||'No se detectó texto';document.getElementById('ocrResult').classList.remove('hidden');status.textContent='Lectura finalizada. Revisa los resultados antes de guardar.'}catch(err){status.textContent='No fue posible leer automáticamente la imagen. Puedes registrar los datos manualmente.'}finally{scan.disabled=false}};document.getElementById('applyOcrBtn').onclick=()=>{cardioType.value=ocrParsed.type||'Natación';cardioDuration.value=ocrParsed.duration||'';cardioDistance.value=ocrParsed.distance||'';cardioCalories.value=ocrParsed.calories||'';heartRate.value=ocrParsed.heartRate||'';cardioPace.value=ocrParsed.pace||'';cardioNotes.value='Importado desde captura. Verificar valores antes de guardar.';toast('Datos aplicados al formulario')}}
function parseCardioText(text){const t=text.replace(/,/g,'.');const duration=(t.match(/(?:duraci[oó]n|tiempo|time)\D{0,15}(\d{1,2}):?(\d{2})?/i)||[]);let mins=duration[2]?num(duration[1])+num(duration[2])/60:num(duration[1]);const dist=(t.match(/(?:distancia|distance)\D{0,15}(\d+(?:\.\d+)?)\s*(km|m)/i)||[]);let distance=num(dist[1]);if(dist[2]?.toLowerCase()==='m')distance/=1000;const cal=(t.match(/(?:calor[ií]as|calories|kcal)\D{0,12}(\d{2,4})/i)||[])[1];const hr=(t.match(/(?:frecuencia|heart rate|fc media|avg hr)\D{0,15}(\d{2,3})/i)||[])[1];const pace=(t.match(/(?:ritmo|pace)\D{0,10}(\d{1,2}:\d{2}(?:\s*\/\s*(?:100\s*m|km))?)/i)||[])[1];const type=/nataci[oó]n|swim|piscina/i.test(t)?'Natación':/escalera|stair/i.test(t)?'Escalera':/el[ií]ptica|elliptical/i.test(t)?'Elíptica':/bicicleta|bike|cycling/i.test(t)?'Bicicleta':/caminadora|treadmill/i.test(t)?'Caminadora':'Otro';return{type,duration:Math.round(mins||0),distance:distance||0,calories:num(cal),heartRate:num(hr),pace:pace||''}}

function bindDataControls(){document.getElementById('exportBtn').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));a.download=`fitcontrol-respaldo-${today()}.json`;a.click()};document.getElementById('importInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{db={...defaultDB,...JSON.parse(r.result)};db.recovery=db.recovery||[];db.meta=db.meta||{seedVersion:1};saveDB();toast('Respaldo importado')}catch{toast('Archivo no válido')}};r.readAsText(f)};document.getElementById('resetBtn').onclick=()=>{if(confirm('¿Seguro que deseas borrar todos los datos?')){db=structuredClone(defaultDB);saveDB();toast('Datos eliminados')}}}

function renderAll(){renderDashboard();renderRecent();renderRecovery();renderBodySummary();renderNutrition();renderPlanner();renderHistory();loadSettings()}
function renderDashboard(){const weekStrength=db.strength.filter(x=>within(x.date,7)),weekCardio=db.cardio.filter(x=>within(x.date,7)),weekRecovery=db.recovery.filter(x=>within(x.date,7));const sessionDays=new Set([...weekStrength,...weekCardio].map(x=>x.date.slice(0,10)));const volume=weekStrength.reduce((s,x)=>s+x.weight*x.sets*x.reps,0);const cardio=weekCardio.reduce((s,x)=>s+x.duration,0);const recovery=weekRecovery.reduce((s,x)=>s+x.duration,0);const latest=db.body.at(-1),first=db.body[0];const consistency=Math.min(100,Math.round(sessionDays.size/(db.settings.weeklyGoal||4)*100));statSessions.textContent=sessionDays.size;statSessionsDelta.textContent=`Meta: ${db.settings.weeklyGoal||4}`;statVolume.textContent=`${Math.round(volume).toLocaleString()} kg`;statCardio.textContent=`${Math.round(cardio)} min`;statRecovery.textContent=`${Math.round(recovery)} min`;statWeight.textContent=latest?`${latest.weight.toFixed(1)} kg`:'—';weightTrend.textContent=latest&&first?(latest.weight-first.weight>=0?'+':'')+(latest.weight-first.weight).toFixed(1)+' kg desde el inicio':'Sin registros';consistencyScore.textContent=consistency+'%';consistencyRing.style.background=`conic-gradient(#60a5fa ${consistency}%, transparent 0)`;heroMessage.textContent=sessionDays.size?`Has entrenado ${sessionDays.size} día(s) esta semana. ${consistency>=75?'Vas muy bien con tu constancia.':'Aún puedes acercarte a tu meta semanal.'}`:'Registra tu primera actividad para comenzar a generar recomendaciones.';const rec=getRecommendation();todayRecommendation.innerHTML=`<span class="tag">${rec.group}</span><h4>${rec.title}</h4><p>${rec.reason}</p>`;renderGoals();renderCharts();populateExerciseSelect()}
function getRecommendation(){const groups=['Piernas','Pecho','Espalda','Hombros','Brazos','Core'];const last={};db.strength.forEach(x=>last[x.muscle]=Math.max(last[x.muscle]||0,new Date(x.date).getTime()));groups.sort((a,b)=>(last[a]||0)-(last[b]||0));const group=groups[0];const recentHard=db.strength.filter(x=>within(x.date,2)&&x.rpe>=8).length;return recentHard?{group:'Recuperación activa',title:'Cardio moderado + movilidad',reason:'Tus registros recientes muestran esfuerzo alto. Conviene priorizar recuperación y técnica.'}:{group,title:`Sesión de ${group.toLowerCase()}`,reason:`Es el grupo con más tiempo sin trabajo registrado, ayudando a mantener un entrenamiento equilibrado.`}}
function renderGoals(){const latest=db.body.at(-1);let items=[];if(latest&&db.settings.targetWeight){const diff=db.settings.targetWeight-latest.weight;items.push({a:`Peso objetivo: ${db.settings.targetWeight} kg`,b:`Faltan ${Math.abs(diff).toFixed(1)} kg para llegar a la meta.`})}const recent=db.strength.filter(x=>within(x.date,30));if(recent.length){const best=recent.reduce((a,b)=>(b.weight>b.weight?a:b),recent[0]);items.push({a:'Progresión de fuerza',b:'Busca aumentar 2.5–5% cuando completes todas las repeticiones con buena técnica.'})}items.push({a:'Constancia semanal',b:`Objetivo configurado: ${db.settings.weeklyGoal||4} sesiones por semana.`});goalsProjection.innerHTML=items.map(x=>`<div class="goal-item"><strong>${x.a}</strong><span>${x.b}</span></div>`).join('')}
function makeChart(id,config){if(charts[id])charts[id].destroy();const ctx=document.getElementById(id);if(ctx&&window.Chart)charts[id]=new Chart(ctx,config)}
function renderCharts(){const range=num(projectionRange.value)||30;const labels=db.body.map(x=>x.date),data=db.body.map(x=>x.weight);let projectedLabels=[],projected=[];if(db.body.length>=2){const a=db.body[0],b=db.body.at(-1),days=Math.max(1,(new Date(b.date)-new Date(a.date))/864e5),slope=(b.weight-a.weight)/days;for(let i=1;i<=range;i+=Math.max(1,Math.floor(range/10))){const d=new Date(b.date);d.setDate(d.getDate()+i);projectedLabels.push(d.toISOString().slice(0,10));projected.push(Number((b.weight+slope*i).toFixed(1)))}}makeChart('weightChart',{type:'line',data:{labels:[...labels,...projectedLabels],datasets:[{label:'Peso real',data:[...data,...Array(projected.length).fill(null)],tension:.3},{label:'Proyección',data:[...Array(Math.max(0,data.length-1)).fill(null),data.at(-1)||null,...projected],borderDash:[6,5],tension:.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});const counts={Fuerza:db.strength.filter(x=>within(x.date,30)).length,Cardio:db.cardio.filter(x=>within(x.date,30)&&x.type!=='Natación').length,Natación:db.cardio.filter(x=>within(x.date,30)&&x.type==='Natación').length,Recuperación:db.recovery.filter(x=>within(x.date,30)).length};makeChart('activityChart',{type:'doughnut',data:{labels:Object.keys(counts),datasets:[{data:Object.values(counts)}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});renderExerciseChart()}
function populateExerciseSelect(){const names=[...new Set(db.strength.map(x=>x.exercise))];exerciseCompareSelect.innerHTML=names.length?names.map(x=>`<option>${x}</option>`).join(''):'<option>Sin datos</option>'}
function renderExerciseChart(){const name=exerciseCompareSelect.value,arr=db.strength.filter(x=>x.exercise===name).sort((a,b)=>new Date(a.date)-new Date(b.date));makeChart('exerciseChart',{type:'bar',data:{labels:arr.map(x=>x.date.slice(0,10)),datasets:[{label:'Peso utilizado (kg)',data:arr.map(x=>x.weight)},{label:'Volumen / 100',data:arr.map(x=>x.weight*x.sets*x.reps/100)}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true}}}})}
function renderRecent(){const arr=[...db.strength].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);recentStrength.innerHTML=arr.length?arr.map(x=>`<div class="timeline-item"><strong>${x.exercise}</strong><span>${fmtDate(x.date)} · ${x.weight} kg · ${x.sets}×${x.reps} · RPE ${x.rpe}</span></div>`).join(''):'<p class="disclaimer">Aún no hay ejercicios registrados.</p>'}
function renderRecovery(){const arr=[...(db.recovery||[])].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);recentRecovery.innerHTML=arr.length?arr.map(x=>`<div class="timeline-item"><strong>${x.type}</strong><span>${fmtDate(x.date)} · ${x.duration} min · sensación ${x.feeling}/10${x.water?` · ${x.water} ml`:''}</span></div>`).join(''):'<p class="disclaimer">Aún no hay actividades de recuperación registradas. Registra aquí tus sesiones de sauna.</p>'}
function renderBodySummary(){const fields=[['weight','Peso','kg'],['waist','Cintura','cm'],['chest','Pecho','cm'],['hips','Cadera','cm'],['arm','Brazo','cm'],['thigh','Muslo','cm'],['bodyFat','Grasa corporal','%']];const a=db.body[0],b=db.body.at(-1);measurementSummary.innerHTML=fields.map(([k,n,u])=>{const val=b?.[k]||0,diff=a&&b?val-(a[k]||0):0;return `<div class="measurement-card"><strong>${val?val.toFixed(1)+' '+u:'—'}</strong><span>${n}${a&&b&&val?` · ${diff>=0?'+':''}${diff.toFixed(1)} ${u}`:''}</span></div>`}).join('')}
function renderNutrition(){const todayMeals=db.nutrition.filter(x=>x.date.slice(0,10)===today());todayCalories.textContent=todayMeals.reduce((s,x)=>s+x.calories,0);todayProtein.textContent=todayMeals.reduce((s,x)=>s+x.protein,0).toFixed(0)+' g';todayWater.textContent=todayMeals.reduce((s,x)=>s+x.water,0)+' ml';todayMeals.textContent=todayMeals.length;calorieTargetLabel.textContent=`Meta: ${db.settings.calorieTarget||'—'} kcal`;proteinTargetLabel.textContent=`Meta: ${db.settings.proteinTarget||'—'} g`;const goal=db.settings.goal;const plans={fat_loss:[['Desayuno','Proteína magra + fruta + cereal integral'],['Almuerzo','½ verduras, ¼ proteína, ¼ carbohidrato'],['Merienda','Yogur natural o fruta con proteína'],['Cena','Proteína, verduras y porción moderada de carbohidrato']],muscle_gain:[['Desayuno','Proteína + avena o pan integral + fruta'],['Almuerzo','Proteína abundante + arroz/papa + verduras'],['Post-entreno','Proteína y carbohidrato fácil de digerir'],['Cena','Proteína + carbohidrato + vegetales']],fitness:[['Desayuno','Comida equilibrada con proteína y fibra'],['Almuerzo','Plato variado y suficiente hidratación'],['Merienda','Fruta, yogur o frutos secos'],['Cena','Comida ligera pero completa']],maintenance:[['Desayuno','Proteína, fruta y cereal integral'],['Almuerzo','Plato equilibrado'],['Merienda','Opción pequeña y nutritiva'],['Cena','Proteína y vegetales']]};nutritionPlan.innerHTML=plans[goal].map(x=>`<div class="meal-suggestion"><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join('')}
function renderPlanner(variant=0){const rec=getRecommendation();plannerTitle.textContent=rec.title;plannerReason.textContent=rec.reason;let group=rec.group;if(group==='Recuperación activa'){dailyPlan.innerHTML=[['Caminata o bicicleta','Cardio suave','20–30 min, RPE 4–5'],['Movilidad general','Colchoneta','10–15 min'],['Core ligero','Plancha','3×20–30 s']].map(cardTpl).join('')}else{const pool=exerciseLibrary[group]||exerciseLibrary.Core;const rotated=[...pool.slice(variant),...pool.slice(0,variant)].slice(0,5);dailyPlan.innerHTML=rotated.map((x,i)=>cardTpl([x[0],x[1],i===0?'4×12–15':i<3?'3–4×10–15':'3×12–20'],i)).join('')}plannerRules.innerHTML=['Evita repetir un grupo trabajado intensamente en las últimas 48 horas.','Prioriza grupos con más días sin registro.','Reduce intensidad cuando los últimos esfuerzos fueron RPE 8–10.','Aumenta el peso solo si completas las repeticiones con técnica estable y sin dolor.'].map(x=>`<div class="rule-item">✓ <span>${x}</span></div>`).join('')}
function cardTpl(x,i=0){
 const guide=exerciseGuides[x[0]]||['Realiza el movimiento con control y técnica estable.','Trabajo general'];
 return `<article class="exercise-card">
   <div class="exercise-visual"><img src="${exerciseAsset(x[0])}" alt="Demostración de ${x[0]} usando ${x[1]}" loading="lazy"><span class="number">${i+1}</span></div>
   <div class="exercise-card-body">
    <span class="muscle-chip">${guide[1]}</span>
    <h3>${x[0]}</h3>
    <div class="equipment-box"><span class="equipment-icon">🏋️</span><div><small>Máquina o elemento</small><strong>${x[1]}</strong></div></div>
    <p class="exercise-instruction">${guide[0]}</p>
    <div class="prescription"><span>Rutina sugerida</span><strong>${x[2]}</strong></div>
    <button class="btn primary full exercise-start" onclick="prefillSuggestedExercise('${x[0].replace(/'/g,"\'")}','${x[1].replace(/'/g,"\'")}')">Registrar este ejercicio</button>
   </div>
  </article>`
}
window.prefillSuggestedExercise=(name,equipment)=>{
 const group=Object.keys(exerciseLibrary).find(g=>exerciseLibrary[g].some(x=>x[0]===name))||'Core';
 document.querySelector('[data-view="workouts"]').click();
 exerciseName.value=name;document.getElementById('equipment').value=equipment;muscleGroup.value=group;
 strengthDate.value=nowLocal();machineWeight.focus();toast('Ejercicio cargado. Completa el peso y guarda tu resultado.');
}
function renderHistory(){const type=historyType.value,q=historySearch.value.toLowerCase();let rows=[];if(type==='all'||type==='strength')rows.push(...db.strength.map(x=>({id:x.id,type:'Fuerza',date:x.date,detail:`${x.exercise} · ${x.weight} kg · ${x.sets}×${x.reps}`,source:'strength'})));if(type==='all'||type==='cardio')rows.push(...db.cardio.map(x=>({id:x.id,type:x.type,date:x.date,detail:`${x.duration} min · ${x.distance||0} km · ${x.calories||0} kcal`,source:'cardio'})));if(type==='all'||type==='recovery')rows.push(...db.recovery.map(x=>({id:x.id,type:x.type,date:x.date,detail:`${x.duration} min · sensación ${x.feeling}/10${x.water?` · ${x.water} ml de agua`:''}`,source:'recovery'})));if(type==='all'||type==='body')rows.push(...db.body.map(x=>({id:x.id,type:'Medidas',date:x.date,detail:`Peso ${x.weight} kg · Cintura ${x.waist||'—'} cm`,source:'body'})));if(type==='all'||type==='nutrition')rows.push(...db.nutrition.map(x=>({id:x.id,type:x.type,date:x.date,detail:`${x.name} · ${x.calories} kcal · ${x.protein} g proteína`,source:'nutrition'})));rows=rows.filter(x=>(x.type+' '+x.detail).toLowerCase().includes(q)).sort((a,b)=>new Date(b.date)-new Date(a.date));historyTable.innerHTML=rows.length?`<table class="data-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${x.type}</td><td>${x.detail}</td><td><button class="btn secondary" onclick="editItem('${x.source}','${x.id}')">Editar</button> <button class="delete-btn" onclick="deleteItem('${x.source}','${x.id}')">Eliminar</button></td></tr>`).join('')}</tbody></table>`:'<p class="disclaimer">No hay registros que coincidan con el filtro.</p>'}
window.editItem=(source,id)=>{
 const item=db[source]?.find(x=>x.id===id);if(!item)return;
 if(source==='strength'){
  const weight=prompt('Peso utilizado en kg:',item.weight||'');if(weight===null)return;
  const setsV=prompt('Series:',item.sets);if(setsV===null)return;
  const repsV=prompt('Repeticiones:',item.reps);if(repsV===null)return;
  const durationV=prompt('Duración en minutos:',item.duration||'');if(durationV===null)return;
  item.weight=num(weight);item.sets=num(setsV)||item.sets;item.reps=num(repsV)||item.reps;item.duration=num(durationV);
 }else if(source==='recovery'){
  const durationV=prompt('Duración en minutos:',item.duration);if(durationV===null)return;
  item.duration=num(durationV)||item.duration;
 }else{toast('Este registro se puede reemplazar eliminándolo y registrándolo nuevamente');return}
 saveDB();toast('Registro actualizado');
}
window.deleteItem=(source,id)=>{db[source]=db[source].filter(x=>x.id!==id);saveDB();toast('Registro eliminado')}
function loadSettings(){const s=db.settings;profileName.value=s.name||'';profileAge.value=s.age||'';profileHeight.value=s.height||'';profileGoal.value=s.goal||'fat_loss';targetWeight.value=s.targetWeight||'';weeklyGoal.value=s.weeklyGoal||4;calorieTarget.value=s.calorieTarget||'';proteinTarget.value=s.proteinTarget||'';limitations.value=s.limitations||''}

document.addEventListener('DOMContentLoaded',init);
