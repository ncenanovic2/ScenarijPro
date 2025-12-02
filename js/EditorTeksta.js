let EditorTeksta = function (divRef) {
    if (!(divRef instanceof HTMLDivElement)) {
        throw new Error("Pogresan tip elementa!"); 
    }
    // Provjera atributa contenteditable
    if (divRef.getAttribute('contenteditable') !== 'true') {
        throw new Error("Neispravan DIV, ne posjeduje contenteditable atribut!"); 
    }

    const editor = divRef;
const punctuationRegex = /[.,!?"'(){}[\]:;@#$%^&*+=/\\|<>\s\n\r]/g; 
const wordRegex = /[\p{L}\d'-]+/gu;
    
    const getLines = function() {
        const text = editor.innerText || "";
        return text.split('\n');
    };

    // Pomoćne funkcije za određivanje tipa linije
    const isParenthetical = function(line) {
        const trimmed = line.trim();
        // Linija koja u potpunosti sadrži scensku napomenu u zagradam
        return trimmed.length > 0 && trimmed.startsWith('(') && trimmed.endsWith(')') && /^\([\s\S]*\)$/.test(trimmed);
    };

    const isSceneHeading = function(line) {
        const trimmed = line.trim().toUpperCase();
        // INT./EXT. nakon čega slijedi crtica, razmak i jedna od ključnih riječi
        return (trimmed.startsWith('INT.') || trimmed.startsWith('EXT.')) && 
               /(INT\.|EXT\.).* - (DAY|NIGHT|AFTERNOON|MORNING|EVENING)$/.test(trimmed);
    };

    const isRoleLine = function(line, nextLine) {
        const trimmed = line.trim();
        if (trimmed.length === 0 || isSceneHeading(trimmed) || isParenthetical(trimmed)) return false;

        // Ime uloge: isključivo velika slova, bez drugih znakova (brojeva, interpunkcije), uz razmak. 
        const isAllUpperCase = trimmed === trimmed.toUpperCase();
        const hasOnlyLettersAndSpaces = /^[A-ZČĆŽŠĐ\s]+$/.test(trimmed);
        const hasAtLeastOneLetter = /[A-ZČĆŽŠĐ]/.test(trimmed);
        
        // Mora imati barem jedno slovo i ne smije biti naslov scene.
        const potentialRole = isAllUpperCase && hasOnlyLettersAndSpaces && hasAtLeastOneLetter && !isSceneHeading(trimmed);

        // Provjera validnosti: mora postojati bar jedna linija govora ispod 
        if (potentialRole) {
            if (nextLine) {
                // Običan govor: nije prazna i nije napisana isključivo velikim slovima (tj. nije nova uloga) 
                const nextTrimmed = nextLine.trim();
                return nextTrimmed.length > 0 && nextTrimmed !== nextLine.toUpperCase();
            }
            return false;
        }

        return false;
    };
    
    // Pomoćna funkcija za parsiranje blokova govora (replika)
    const parseDialogues = function() {
        const lines = getLines();
        const dialogues = [];
        let currentScene = 'NEMA SCENE'; 

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            const nextLine = (i + 1 < lines.length) ? lines[i+1] : null;

            // 1. Provjera naslova scene
            if (isSceneHeading(trimmedLine)) {
                currentScene = trimmedLine;
                continue;
            }

            // 2. Provjera uloge
            if (isRoleLine(line, nextLine)) {
                const roleName = trimmedLine;
                const dialogueLines = [];
                let actionSegmentBreak = false; // Flag za prekid bloka govora

                // Traženje linija govora (blok govora/replika) 
                let j = i + 1; // Počinje odmah ispod linije uloge
                while (j < lines.length) {
                    const currentLine = lines[j];
                    const currentTrimmed = currentLine.trim();

                    if (currentTrimmed === '') {
                        // Prazna linija ne prekida dijalog-segment sama, ali prekida BLOK GOVORA.
                        break; 
                    }
                    
                    if (isSceneHeading(currentTrimmed)) {
                        break; // Nova scena prekida BLOK GOVORA
                    }
                    
                    if (isRoleLine(currentLine, (j + 1 < lines.length) ? lines[j+1] : null)) {
                        break; // Nova uloga prekida BLOK GOVORA
                    }

                    if (isParenthetical(currentTrimmed)) {
                        // Linije u zagradama ne ulaze u blok, ali ga ne prekidaju 
                        j++;
                        continue;
                    }
               
                    
                    if (currentTrimmed === currentTrimmed.toUpperCase() && /[A-ZČĆŽŠĐ]/.test(currentTrimmed)) {
                 
                        if (dialogueLines.length > 0) {
                            if (currentTrimmed === currentTrimmed.toUpperCase() && /[A-ZČĆŽŠĐ]/.test(currentTrimmed)) {

                                actionSegmentBreak = true;
                                break;
                            }
                        }
                    }

                    // Linija je običan govor 
                    dialogueLines.push(currentTrimmed);
                    j++;
                }

                if (dialogueLines.length > 0) {
                    // Replika je pronađena
                    dialogues.push({
                        role: roleName,
                        lines: dialogueLines,
                        scene: currentScene,
                        startIndex: i, // Index linije sa imenom uloge
                        endIndex: j - 1, // Index zadnje obrađene linije govora
                        rawLines: lines.slice(i, j) // Čuva linije uloge i govora za kasniju provjeru akcije/prazne linije
                    });
                }
                
                i = j - 1; 
            }
        }
        
        return dialogues;
    };

    const levenshteinDistance = function(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = a[j - 1] === b[i - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + cost,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
        return matrix[b.length][a.length];
    };

    const hasActionSegmentBetween = function(dialogue1, dialogue2) {
        const lines = getLines();
        let startIndex = dialogue1.endIndex + 1;
        let endIndex = dialogue2.startIndex;

        if (endIndex <= startIndex) return false; 

        for (let i = startIndex; i < endIndex; i++) {
            const line = lines[i].trim();
            // Prazna linija ne prekida dijalog-segment osim ako je praćena akcijom/scenom 
            if (line === '') continue;

            // Linija u zagradama ne prekida segment, ali nije akcijski segment 
            if (isParenthetical(line)) continue; 

            // Ako nije prazna, nije zagrada, nije naslov (provjereno prije), i nije uloga (provjereno prije), onda je to AKCIJSKI SEGMENT 
            return true; 
        }
        return false;
    };


const dajBrojRijeci = function() {

    
    // Zamijeniti HTML tagove sa razmakom
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editor.innerHTML.replace(/<br\s*\/?>/gi, ' '); 
    let textWithoutTags = tempDiv.textContent || tempDiv.innerText || '';
    
    
    let cleanText = textWithoutTags.replace(punctuationRegex, (match) => {
        // Ostavljamo '-' i "'" da ih wordRegex tretira kao dio riječi
        if (match === '-' || match === "'") return match;
        return ' '; 
    });
    
    // Uklanjanje više uzastopnih razmaka
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

  
    let rawWords = cleanText.match(wordRegex) || [];

 
    const letterPresenceRegex = /\p{L}/u; 

    rawWords = rawWords.filter(word => {
        // Zadrži samo segmente koji sadrže barem jedno slovo.
        return letterPresenceRegex.test(word);
    });

    const totalWords = rawWords.length;
    

    
    let boldCount = 0;
    let italicCount = 0;
    
    const countedBoldWords = new Set();
    const countedItalicWords = new Set();

    const checkFormatted = (selector, targetSet) => {
    
        editor.querySelectorAll(selector).forEach(element => {
      
            const formattedText = element.textContent;
            
       
            const wordsInTag = formattedText.match(wordRegex) || [];
            
            wordsInTag.forEach(word => {
              
                if (rawWords.includes(word) && !targetSet.has(word)) {
                    targetSet.add(word); 
                }
            });
        });
    }

    checkFormatted('b, strong', countedBoldWords);
    
    checkFormatted('i, em', countedItalicWords);
    
    boldCount = countedBoldWords.size;
    italicCount = countedItalicWords.size;
    
    return {
        ukupno: totalWords,
        boldiranih: boldCount,
        italic: italicCount
    };
};

    const dajUloge = function() {
        const dialogues = parseDialogues();
        const roles = new Map(); 
        
      
        dialogues.forEach(dialogue => {
            if (!roles.has(dialogue.role)) {
                roles.set(dialogue.role, dialogue.startIndex);
            }
        });
        
        return Array.from(roles.entries())
            .sort((a, b) => a[1] - b[1])
            .map(entry => entry[0]);
    };

    const pogresnaUloga = function() {
        const roles = dajUloge();
        const dialogues = parseDialogues();
        
        const roleCount = new Map();
        dialogues.forEach(dialogue => {
            roleCount.set(dialogue.role, (roleCount.get(dialogue.role) || 0) + 1);
        });
        
        const potentiallyWrong = new Set();
        
        for (let i = 0; i < roles.length; i++) {
            const roleA = roles[i];
            const countA = roleCount.get(roleA) || 0;
            const roleAStripped = roleA.replace(/\s/g, ''); 

            for (let j = 0; j < roles.length; j++) {
                if (i === j) continue;
                
                const roleB = roles[j];
                const countB = roleCount.get(roleB) || 0;
                const roleBStripped = roleB.replace(/\s/g, '');
                
            
                const distance = levenshteinDistance(roleAStripped, roleBStripped);
                
               
                let maxDistance = 1;
                if (roleAStripped.length > 5 && roleBStripped.length > 5) {
                    maxDistance = 2;
                }
                
            
                if (distance <= maxDistance && 
                    countB >= 4 && 
                    (countB - countA) >= 3) {
                    potentiallyWrong.add(roleA);
                }
            }
        }
        
        return Array.from(potentiallyWrong);
    };

    const brojLinijaTeksta = function(uloga) {
        const dialogues = parseDialogues();
        const targetRole = uloga.toUpperCase();
        let totalLines = 0;
        
        // Brojanje linija samo unutar validnih blokova govora
        dialogues.forEach(dialogue => {
            if (dialogue.role.toUpperCase() === targetRole) {
                totalLines += dialogue.lines.length;
            }
        });
        
        return totalLines;
    };

    const scenarijUloge = function(uloga) {
        const dialogues = parseDialogues();
        const targetRole = uloga.toUpperCase();
        const result = [];
        
        // Ako uloga ne postoji (nema validne replike), vrati prazan niz 
        if (!dialogues.some(d => d.role.toUpperCase() === targetRole)) {
            return [];
        }

        // Grupisanje dijaloga po scenama
        const scenes = new Map();
        dialogues.forEach(dialogue => {
            if (!scenes.has(dialogue.scene)) {
                scenes.set(dialogue.scene, []);
            }
            scenes.get(dialogue.scene).push(dialogue);
        });
        
        // Obrada po scenama
        scenes.forEach((sceneDialogues, sceneName) => {
            for (let i = 0; i < sceneDialogues.length; i++) {
                const current = sceneDialogues[i];
                
                if (current.role.toUpperCase() === targetRole) {
                    // Replika je pronađena, kreiramo stavku
                    const item = {
                        scena: sceneName,
                        // Pozicija replike (bloka govora) unutar scene (indeks od 1)
                        pozicijaUTekstu: i + 1, 
                        prethodni: null,
                        trenutni: {
                            uloga: current.role, // Vraća se kako je napisano (velikim slovima)
                            linije: current.lines.join('\n')
                        },
                        sljedeci: null
                    };

                    // Prethodna replika
                    if (i > 0) {
                        // Da li je prekinut dijalog-segment između?
                        if (!hasActionSegmentBetween(sceneDialogues[i - 1], current) && 
                            sceneDialogues[i - 1].scene === current.scene) {
                            const prev = sceneDialogues[i - 1];
                            item.prethodni = {
                                uloga: prev.role,
                                linije: prev.lines.join('\n')
                            };
                        } else {
                            // Ako je prekid, prethodni je null (otvara dijalog-segment) 
                            item.prethodni = null;
                        }
                    } else {
                    
                         item.prethodni = null; // [cite: 68]
                    }
                    
                    // Sljedeća replika
                    if (i < sceneDialogues.length - 1) {
                        // Da li je prekinut dijalog-segment između?
                        if (!hasActionSegmentBetween(current, sceneDialogues[i + 1]) && 
                            sceneDialogues[i + 1].scene === current.scene) {
                            const next = sceneDialogues[i + 1];
                            item.sljedeci = {
                                uloga: next.role,
                                linije: next.lines.join('\n')
                            };
                        } else {
                            // Ako je prekid, sljedeći je null (zatvara dijalog-segment) 
                            item.sljedeci = null;
                        }
                    } else {
                        // Zadnja replika u sceni zatvara dijalog-segment
                        item.sljedeci = null; 
                    }
                    
                    result.push(item);
                }
            }
        });
        
        return result;
    };

    const grupisiUloge = function() {
        const dialogues = parseDialogues();
        const result = [];
        
        // Grupisanje po scenama
        const scenes = new Map();
        dialogues.forEach(dialogue => {
            if (!scenes.has(dialogue.scene)) {
                scenes.set(dialogue.scene, []);
            }
            scenes.get(dialogue.scene).push(dialogue);
        });
        
        // Obrada svake scene
        scenes.forEach((sceneDialogues, sceneName) => {
            if (sceneDialogues.length === 0) return; // Ukoliko scena nema niti jednu repliku, ne pravi se grupa 

            let segments = [];
            let currentSegment = new Map(); 
            
            for (let i = 0; i < sceneDialogues.length; i++) {
                const currentDialogue = sceneDialogues[i];
                
              
                if (!currentSegment.has(currentDialogue.role)) {
                    currentSegment.set(currentDialogue.role, i);
                }
                
              
                let isSegmentEnd = false;
                
                if (i === sceneDialogues.length - 1) {
                    isSegmentEnd = true; // Kraj scene
                } else {
                   

                    if (hasActionSegmentBetween(currentDialogue, sceneDialogues[i + 1])) {
                        isSegmentEnd = true;
                    }
                }
                
                if (isSegmentEnd) {
                 
                    let rolesArray = Array.from(currentSegment.entries())
                        .sort((a, b) => a[1] - b[1]) 
                        .map(entry => entry[0]);

                    segments.push({
                        scena: sceneName,
                        uloge: rolesArray,
                    });
                    currentSegment = new Map(); 
                }
            }
            
            // Dodavanje u rezultat (sortirano po redoslijedu pojavljivanja)
            segments.forEach((segment, index) => {
                result.push({
                    scena: segment.scena,
                    segment: index + 1,
                    uloge: segment.uloge
                });
            });
        });
        
        return result;
    };

    const formatirajTekst = function(komanda) {
        const selection = window.getSelection();
        
   
        if (selection.rangeCount === 0 || selection.toString().length === 0) {
            return false;
        }
      
        const range = selection.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) {
            return false;
        }
        
        let commandName;
        switch (komanda) {
            case 'bold':
                commandName = 'bold';
                break;
            case 'italic':
                commandName = 'italic';
                break;
            case 'underline':
                commandName = 'underline';
                break;
            default:
                return false;
        }
        
        
        document.execCommand(commandName, false, null);
        
     
        return true;
    };

    // Public interfejs modula
    return {
        dajBrojRijeci: dajBrojRijeci,
        dajUloge: dajUloge,
        pogresnaUloga: pogresnaUloga,
        brojLinijaTeksta: brojLinijaTeksta,
        scenarijUloge: scenarijUloge,
        grupisiUloge: grupisiUloge,
        formatirajTekst: formatirajTekst
    };
};