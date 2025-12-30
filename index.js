const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// 1. STATIČKI FAJLOVI
// Budući da je server.js u rootu, putanje su direktne
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/json', express.static(path.join(__dirname, 'json')));

// Servira writing.html direktno iz /html foldera
// URL će biti: http://localhost:3000/writing.html
app.use(express.static(path.join(__dirname, 'html')));

// 2. MIDDLEWARE
app.use(express.json());

// 3. PUTANJE DO PODATAKA
const DATA_DIR = path.join(__dirname, 'data');
const SCENARIOS_DIR = path.join(DATA_DIR, 'scenarios');
const DELTAS_FILE = path.join(DATA_DIR, 'deltas.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(SCENARIOS_DIR)) fs.mkdirSync(SCENARIOS_DIR);
if (!fs.existsSync(DELTAS_FILE)) fs.writeFileSync(DELTAS_FILE, '[]');

let locks = new Map(); 
let characterLocks = new Map(); 

app.post('/api/scenarios', (req, res) => {
    const files = fs.readdirSync(SCENARIOS_DIR);
    const id = files.length + 1;
    let { title } = req.body;

    if (!title || title.trim() === "") {
        title = "Neimenovani scenarij"; 
    }

    const scenario = {
        id,
        title,
        content: [{ lineId: 1, text: "", nextLineId: null }] 
    };

    fs.writeFileSync(path.join(SCENARIOS_DIR, `scenario-${id}.json`), JSON.stringify(scenario, null, 2));
    res.status(200).json(scenario);
});


app.post('/api/scenarios/:scenarioId/lines/:lineId/lock', (req, res) => {
    const { scenarioId, lineId } = req.params;
    const { userId } = req.body;

    const p = path.join(SCENARIOS_DIR, `scenario-${scenarioId}.json`);
    if (!fs.existsSync(p)) return res.status(404).json({ message: "Scenario ne postoji!" });

    const scenario = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!scenario.content.some(l => l.lineId == lineId)) {
        return res.status(404).json({ message: "Linija ne postoji!" });
    }

  
    for (let [uId, lock] of locks.entries()) {
        if (lock.scenarioId == scenarioId && lock.lineId == lineId && uId != userId) {
            return res.status(409).json({ message: "Linija je vec zakljucana!" });
        }
    }

 
    locks.set(Number(userId), { scenarioId, lineId });
    res.status(200).json({ message: "Linija je uspjesno zakljucana!" });
});


app.put('/api/scenarios/:scenarioId/lines/:lineId', (req, res) => {
    const { scenarioId, lineId } = req.params;
    const { userId, newText } = req.body;

    if (!newText || !Array.isArray(newText) || newText.length === 0) {
        return res.status(400).json({ message: "Niz new_text ne smije biti prazan!" }); 
    }

    const p = path.join(SCENARIOS_DIR, `scenario-${scenarioId}.json`);
    if (!fs.existsSync(p)) return res.status(404).json({ message: "Scenario ne postoji!" });

    let scenario = JSON.parse(fs.readFileSync(p, 'utf8'));
    let lineIdx = scenario.content.findIndex(l => l.lineId == lineId);
    if (lineIdx === -1) return res.status(404).json({ message: "Linija ne postoji!" });

 
    const currentLock = locks.get(Number(userId));
    if (!currentLock || currentLock.scenarioId != scenarioId || currentLock.lineId != lineId) {
      
        let isAnyLocked = Array.from(locks.values()).some(l => l.scenarioId == scenarioId && l.lineId == lineId);
        return res.status(409).json({ message: isAnyLocked ? "Linija je vec zakljucana!" : "Linija nije zakljucana!" });
    }

    let processedLines = [];
    newText.forEach(t => {
        let words = t.trim().split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) processedLines.push("");
        else {
            for (let i = 0; i < words.length; i += 20) {
                processedLines.push(words.slice(i, i + 20).join(' '));
            }
        }
    });

    const originalNext = scenario.content[lineIdx].nextLineId;
    let maxId = Math.max(...scenario.content.map(l => l.lineId), 0);
    
   
    let newContentObjects = processedLines.map((txt, i) => ({
        lineId: i === 0 ? Number(lineId) : ++maxId,
        text: txt,
        nextLineId: null
    }));

    for (let i = 0; i < newContentObjects.length - 1; i++) {
        newContentObjects[i].nextLineId = newContentObjects[i+1].lineId;
    }
    newContentObjects[newContentObjects.length - 1].nextLineId = originalNext;

    scenario.content.splice(lineIdx, 1, ...newContentObjects);
    fs.writeFileSync(p, JSON.stringify(scenario, null, 2));

 
    let deltas = JSON.parse(fs.readFileSync(DELTAS_FILE, 'utf8'));
    const ts = Math.floor(Date.now() / 1000);
    newContentObjects.forEach(ln => {
        deltas.push({
            scenarioId: Number(scenarioId),
            type: "line_update",
            lineId: ln.lineId,
            nextLineId: ln.nextLineId,
            content: ln.text,
            timestamp: ts
        });
    });
    fs.writeFileSync(DELTAS_FILE, JSON.stringify(deltas, null, 2));

    locks.delete(Number(userId)); 
    res.status(200).json({ message: "Linija je uspjesno azurirana!" });
});


app.post('/api/scenarios/:scenarioId/characters/lock', (req, res) => {
    const { scenarioId } = req.params;
    const { userId, characterName } = req.body;

    if (!fs.existsSync(path.join(SCENARIOS_DIR, `scenario-${scenarioId}.json`))) {
        return res.status(404).json({ message: "Scenario ne postoji!" });
    }

    const lockKey = `${scenarioId}-${characterName}`;
    if (characterLocks.has(lockKey) && characterLocks.get(lockKey) != userId) {
        return res.status(409).json({ message: "Konflikt! Ime lika je vec zakljucano!" }); 
    }

    characterLocks.set(lockKey, Number(userId));
    res.status(200).json({ message: "Ime lika je uspjesno zakljucano!" });
});


app.post('/api/scenarios/:scenarioId/characters/update', (req, res) => {
    const { scenarioId } = req.params;
    const { userId, oldName, newName } = req.body;

    const p = path.join(SCENARIOS_DIR, `scenario-${scenarioId}.json`);
    if (!fs.existsSync(p)) return res.status(404).json({ message: "Scenario ne postoji!" });

    let scenario = JSON.parse(fs.readFileSync(p, 'utf8'));
    scenario.content.forEach(l => {
        l.text = l.text.split(oldName).join(newName); 
    });
    fs.writeFileSync(p, JSON.stringify(scenario, null, 2));

    let deltas = JSON.parse(fs.readFileSync(DELTAS_FILE, 'utf8'));
    deltas.push({
        scenarioId: Number(scenarioId),
        type: "char_rename",
        oldName,
        newName,
        timestamp: Math.floor(Date.now() / 1000)
    });
    fs.writeFileSync(DELTAS_FILE, JSON.stringify(deltas, null, 2));

    characterLocks.delete(`${scenarioId}-${oldName}`);
    res.status(200).json({ message: "Ime lika je uspjesno promijenjeno!" });
});


app.get('/api/scenarios/:scenarioId/deltas', (req, res) => {
    const { scenarioId } = req.params;
    const since = parseInt(req.query.since || 0);

    if (!fs.existsSync(path.join(SCENARIOS_DIR, `scenario-${scenarioId}.json`))) {
        return res.status(404).json({ message: "Scenario ne postoji!" });
    }

    let deltas = JSON.parse(fs.readFileSync(DELTAS_FILE, 'utf8'));
    let filtered = deltas
        .filter(d => d.scenarioId == scenarioId && d.timestamp > since)
        .sort((a, b) => a.timestamp - b.timestamp) 
        .map(({ scenarioId, ...rest }) => rest); 

    res.status(200).json({ deltas: filtered });
});


app.get('/api/scenarios/:scenarioId', (req, res) => {
    const p = path.join(SCENARIOS_DIR, `scenario-${req.params.scenarioId}.json`);
    if (!fs.existsSync(p)) return res.status(404).json({ message: "Scenario ne postoji!" });

    const scenario = JSON.parse(fs.readFileSync(p, 'utf8'));
    res.status(200).json(scenario);
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));