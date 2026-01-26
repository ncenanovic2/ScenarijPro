const express = require('express');
const path = require('path');
const db = require('./db.js');
const { Op } = require('sequelize');

const app = express();
app.use(express.json());

app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use(express.static(path.join(__dirname, 'html')));
let locks = new Map(); 
let characterLocks = new Map(); 
async function seedDatabase() {
    try {
  
        const scenario = await db.Scenario.create({
            id: 1, 
            title: "Potraga za izgubljenim ključem"
        });

        // 2. Unos Linija (iz scenario-1.js)
        const linesData = [
            { lineId: 1, nextLineId: 2, text: "NARATOR: Sunce je polako zalazilo nad starim gradom.", scenarioId: 1 },
            { lineId: 2, nextLineId: 3, text: "ALICE: Jesi li siguran da je ključ ostao u biblioteci?", scenarioId: 1 },
            { lineId: 3, nextLineId: 4, text: "BOB: To je posljednje mjesto gdje sam ga vidio prije nego što je pala noć.", scenarioId: 1 },
            { lineId: 4, nextLineId: 5, text: "ALICE: Moramo požuriti prije nego što čuvar zaključa glavna vrata.", scenarioId: 1 },
            { lineId: 5, nextLineId: 6, text: "BOB: Čekaj, čuješ li taj zvuk iza polica?", scenarioId: 1 },
            { lineId: 6, nextLineId: null, text: "NARATOR: Iz sjene se polako pojavila nepoznata figura.", scenarioId: 1 }
        ];

        await db.Line.bulkCreate(linesData);

        // 3. Unos Delti (iz deltas.js)
        const deltasData = [
            { scenarioId: 1, type: "line_update", lineId: 1, nextLineId: 2, content: "NARATOR: Sunce je polako zalazilo nad starim gradom.", timestamp: 1736520000 },
            { scenarioId: 1, type: "line_update", lineId: 2, nextLineId: 3, content: "ALICE: Jesi li siguran da je ključ ostao u biblioteci?", timestamp: 1736520010 },
            { scenarioId: 1, type: "line_update", lineId: 3, nextLineId: 4, content: "BOB: To je posljednje mjesto gdje sam ga vidio prije nego što je pala noć.", timestamp: 1736520020 },
            { scenarioId: 1, type: "line_update", lineId: 4, nextLineId: 5, content: "ALICE: Moramo požuriti prije nego što čuvar zaključa glavna vrata.", timestamp: 1736520030 },
            { scenarioId: 1, type: "line_update", lineId: 5, nextLineId: 6, content: "BOB: Čekaj, čuješ li taj zvuk iza polica?", timestamp: 1736520040 },
            { scenarioId: 1, type: "line_update", lineId: 6, nextLineId: null, content: "NARATOR: Iz sjene se polako pojavila nepoznata figura.", timestamp: 1736520050 },
            { scenarioId: 1, type: "char_rename", oldName: "BOB", newName: "ROBERT", timestamp: 1736520100 }
        ];

        await db.Delta.bulkCreate(deltasData);

        console.log("Podaci su uspješno uneseni u bazu!");
    } catch (error) {
        console.error("Greška prilikom unosa u bazu:", error);
    }
}
// --- RUTE ---
app.get('/api/scenarios/:scenarioId', async (req, res) => {
    try {
        const scenario = await db.Scenario.findByPk(req.params.scenarioId, {
            include: [{ model: db.Line }]
        });
        if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });

        const sortedLines = scenario.Lines.sort((a, b) => a.lineId - b.lineId);

        res.status(200).json({
            id: scenario.id,
            title: scenario.title,
            content: sortedLines.map(l => ({
                lineId: l.lineId,
                nextLineId: l.nextLineId,
                text: l.text
            }))
        });
    } catch (err) {
        res.status(500).json({ message: "Greška na serveru" });
    }
});


app.post('/api/scenarios', async (req, res) => {
    let { title } = req.body;
    if (!title || title.trim() === "") title = "Neimenovani scenarij";
    
    try {
        const noviScenario = await db.Scenario.create({ title });
        const prvaLinija = await db.Line.create({
            lineId: 1, text: "", nextLineId: null, scenarioId: noviScenario.id
        });
        
        res.status(200).json({
            id: noviScenario.id, 
            title: noviScenario.title,
            content: [{ 
                lineId: prvaLinija.lineId, 
                text: prvaLinija.text, 
                nextLineId: prvaLinija.nextLineId 
            }]
        });
    } catch (e) { 
        res.status(500).json({ message: "Greška" }); 
    }
});


app.post('/api/scenarios/:scenarioId/lines/:lineId/lock', async (req, res) => {
    const { scenarioId, lineId } = req.params;
    const { userId } = req.body;

    try {
        
        const scenario = await db.Scenario.findByPk(scenarioId);
        if (!scenario) {
            return res.status(404).json({ message: "Scenario ne postoji!" });
        }
        const lines = await db.Line.findAll({ 
            where: { scenarioId: scenarioId } 
        });

        // Provjera da li linija postoji
        if (!lines.some(l => l.lineId == lineId)) {
            return res.status(404).json({ message: "Linija ne postoji!" });
        }

        // Provjera lock konflikta 
        for (let [uId, lock] of locks.entries()) {
            if (lock.scenarioId == scenarioId && lock.lineId == lineId && uId != userId) {
                return res.status(409).json({ message: "Linija je vec zakljucana!" });
            }
        }

    
        locks.delete(Number(userId));
        locks.set(Number(userId), { scenarioId, lineId });
        
        res.status(200).json({ message: "Linija je uspjesno zakljucana!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greška na serveru" });
    }
});

app.put('/api/scenarios/:scenarioId/lines/:lineId', async (req, res) => {
    const { scenarioId, lineId } = req.params;
    const { userId, newText } = req.body;

    if (!newText || !Array.isArray(newText) || newText.length === 0) {
        return res.status(400).json({ message: "Niz new_text ne smije biti prazan!" }); 
    }

    try {
        const scenario = await db.Scenario.findByPk(scenarioId);
        if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });

        const originalLine = await db.Line.findOne({ where: { scenarioId, lineId } });
        if (!originalLine) return res.status(404).json({ message: "Linija ne postoji!" });


        const currentLock = locks.get(Number(userId));
        if (!currentLock || currentLock.scenarioId != scenarioId || currentLock.lineId != lineId) {
            let isAnyLocked = Array.from(locks.values()).some(l => l.scenarioId == scenarioId && l.lineId == lineId);
            return res.status(409).json({ message: isAnyLocked ? "Linija je vec zakljucana!" : "Linija nije zakljucana!" });
        }

    
        let processedLines = [];
        newText.forEach(t => {
            let words = t.trim().split(/\s+/).filter(w => w.length > 0);
            if (words.length === 0) {
                processedLines.push("");
            } else {
                for (let i = 0; i < words.length; i += 20) {
                    processedLines.push(words.slice(i, i + 20).join(' '));
                }
            }
        });

        const originalNext = originalLine.nextLineId;
     
        const allLines = await db.Line.findAll({ where: { scenarioId } });
        let maxId = Math.max(...allLines.map(l => l.lineId), 0);

        let newContentObjects = processedLines.map((txt, i) => ({
            lineId: i === 0 ? Number(lineId) : ++maxId,
            text: txt,
            nextLineId: null,
            scenarioId: Number(scenarioId)
        }));

    
        for (let i = 0; i < newContentObjects.length - 1; i++) {
            newContentObjects[i].nextLineId = newContentObjects[i+1].lineId;
        }
        newContentObjects[newContentObjects.length - 1].nextLineId = originalNext;

        const ts = Math.floor(Date.now() / 1000);
        
     
        await db.Line.destroy({ where: { scenarioId, lineId } });

     
        for (let ln of newContentObjects) {
            await db.Line.create(ln);
            await db.Delta.create({
                scenarioId: Number(scenarioId),
                type: "line_update",
                lineId: ln.lineId,
                nextLineId: ln.nextLineId,
                content: ln.text,
                timestamp: ts
            });
        }

        locks.delete(Number(userId)); 
        res.status(200).json({ message: "Linija je uspjesno azurirana!" });
    } catch (error) { 
        console.error(error);
        res.status(500).json({ message: "Greška na serveru" }); 
    }
});


app.post('/api/scenarios/:scenarioId/characters/lock', async (req, res) => {
    const { scenarioId } = req.params;
    const { userId, characterName } = req.body;
    
    try {
        const scenario = await db.Scenario.findByPk(scenarioId);
        if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });

        const lockKey = `${scenarioId}-${characterName}`;
        if (characterLocks.has(lockKey) && characterLocks.get(lockKey) != userId) {
            return res.status(409).json({ message: "Konflikt! Ime lika je vec zakljucano!" });
        }
        
        characterLocks.set(lockKey, Number(userId));
        res.status(200).json({ message: "Ime lika je uspjesno zakljucano!" });
    } catch (err) { 
        res.status(500).json({ message: "Greška" }); 
    }
});


app.post('/api/scenarios/:scenarioId/characters/update', async (req, res) => {
    const { scenarioId } = req.params;
    const { userId, oldName, newName } = req.body;
    
    try {
        const scenario = await db.Scenario.findByPk(scenarioId);
        if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });

    
        const lines = await db.Line.findAll({ where: { scenarioId } });
        
      
        for (let line of lines) {
            line.text = line.text.split(oldName).join(newName);
            await line.save();
        }
        
   
        await db.Delta.create({
            scenarioId: Number(scenarioId),
            type: "char_rename",
            oldName,
            newName,
            timestamp: Math.floor(Date.now() / 1000)
        });
        
        characterLocks.delete(`${scenarioId}-${oldName}`);
        res.status(200).json({ message: "Ime lika je uspjesno promijenjeno!" });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ message: "Greška" }); 
    }
});


app.get('/api/scenarios/:scenarioId/deltas', async (req, res) => {
    const { scenarioId } = req.params;
    const since = parseInt(req.query.since || 0);
    
    try {
        const scenario = await db.Scenario.findByPk(scenarioId);
        if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });

        const deltas = await db.Delta.findAll({
            where: { scenarioId, timestamp: { [Op.gt]: since } },
            order: [['timestamp', 'ASC']],
            attributes: ['type', 'lineId', 'nextLineId', 'content', 'oldName', 'newName', 'timestamp']
        });
  
        res.status(200).json({ deltas });
    } catch (err) { 
        res.status(500).json({ message: "Greška" }); 
    }
});

app.post('/api/scenarios/:scenarioId/checkpoint', async (req, res) => {
    const { userId } = req.body;
    
    try {
        const scenario = await db.Scenario.findByPk(req.params.scenarioId);
        if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });

        await db.Checkpoint.create({
            scenarioId: Number(req.params.scenarioId),
            timestamp: Math.floor(Date.now() / 1000)
        });
        
        res.status(200).json({ message: "Checkpoint je uspjesno kreiran!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Greška" });
    }
});

app.get('/api/scenarios/:scenarioId/checkpoints', async (req, res) => {
    try {
        const scenario = await db.Scenario.findByPk(req.params.scenarioId);
        if (!scenario) return res.status(404).json({ message: "Scenario ne postoji!" });

        const checkpoints = await db.Checkpoint.findAll({
            where: { scenarioId: req.params.scenarioId },
            attributes: ['id', 'timestamp'],
            order: [['timestamp', 'ASC']]
        });
        res.status(200).json(checkpoints);
    } catch (err) { 
        res.status(500).json({ message: "Greška" }); 
    }
});

app.get('/api/scenarios/:scenarioId/restore/:checkpointId', async (req, res) => {
    try {
        const scenario = await db.Scenario.findByPk(req.params.scenarioId);
        const checkpoint = await db.Checkpoint.findByPk(req.params.checkpointId);
        
        if (!scenario || !checkpoint) {
            return res.status(404).json({ message: "Scenario ili Checkpoint ne postoji!" });
        }

        
        let currentContent = [{ lineId: 1, text: "", nextLineId: null }];
        
        const deltas = await db.Delta.findAll({
            where: { 
                scenarioId: req.params.scenarioId, 
                timestamp: { [Op.lte]: checkpoint.timestamp } 
            },
            order: [['timestamp', 'ASC'], ['id', 'ASC']]
        });

     
        deltas.forEach(delta => {
            if (delta.type === 'line_update') {
                const index = currentContent.findIndex(l => l.lineId === delta.lineId);
                if (index !== -1) {
                    currentContent[index].text = delta.content;
                    currentContent[index].nextLineId = delta.nextLineId;
                } else {
                    currentContent.push({ 
                        lineId: delta.lineId, 
                        text: delta.content, 
                        nextLineId: delta.nextLineId 
                    });
                }
            } else if (delta.type === 'char_rename') {
                currentContent.forEach(line => {
                    line.text = line.text.split(delta.oldName).join(delta.newName);
                });
            }
        });

        res.status(200).json({ 
            id: scenario.id, 
            title: scenario.title, 
            content: currentContent 
        });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ message: "Greška" }); 
    }
});

const PORT = 3000;

db.sequelize.sync({ force: true }).then(async () => {
    locks.clear();
    characterLocks.clear();
    // Pozivamo unos podataka
    await seedDatabase();
    
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:3000`);
    });
}).catch(err => {
    console.error("Greška prilikom inicijalizacije baze podataka:", err);
});