document.addEventListener('DOMContentLoaded', function() {

    const editorDiv = document.getElementById('text-editor');
    const porukeDiv = document.getElementById('poruke');      
    const pDivLock = document.getElementById('porukeDiv');    
    
   
    window.SCENARIO_ID = null; 
    let lastTimestamp = 0; 
    let refreshInterval = null;
    const REFRESH_RATE = 3000; 

  
    let USER_ID = sessionStorage.getItem('userId');
    if (!USER_ID) {
        USER_ID = Math.floor(Math.random() * 1000);
        sessionStorage.setItem('userId', USER_ID);
    } else {
        USER_ID = parseInt(USER_ID);
    }

    const attachListener = (id, handler) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', handler);
        } else {
            console.warn(`Dugme sa ID-jem '${id}' nedostaje u HTML-u.`);
        }
    };

    const formatLinesForHtml = (text) => text ? text.replace(/\n/g, '<br>') : '';

    let editor;
    try {
        if (editorDiv) {
            editor = EditorTeksta(editorDiv);
            
        }
    } catch (e) {
        console.error("Greška pri inicijalizaciji editora:", e.message);
    }



    // --- Dugmad za formatiranje ---
    attachListener('bold-btn', function() {
        const success = editor.formatirajTekst('bold');
        if (porukeDiv) porukeDiv.textContent = success ? 'Tekst je boldiran' : 'Označite tekst za boldiranje';
    });

    attachListener('italic-btn', function() {
        const success = editor.formatirajTekst('italic');
        if (porukeDiv) porukeDiv.textContent = success ? 'Tekst je italic' : 'Označite tekst za italic';
    });

    attachListener('underline-btn', function() {
        const success = editor.formatirajTekst('underline');
        if (porukeDiv) porukeDiv.textContent = success ? 'Tekst je podvučen' : 'Označite tekst za podvlačenje';
    });

  
    attachListener('word-count-btn', function() {
        const result = editor.dajBrojRijeci();
        if (porukeDiv) {
            porukeDiv.innerHTML = `
                <strong>Analiza teksta:</strong><br>
                Ukupno riječi: ${result.ukupno}<br>
                Boldiranih riječi: ${result.boldiranih}<br>
                Italic riječi: ${result.italic}
            `;
        }
    });

    attachListener('show-roles-btn', function() {
        const uloge = editor.dajUloge();
        if (porukeDiv) {
            if (uloge.length > 0) {
                porukeDiv.innerHTML = `<strong>Pronađene uloge:</strong><br>${formatLinesForHtml(uloge.join('\n'))}`;
            } else {
                porukeDiv.textContent = 'Nema pronađenih uloga';
            }
        }
    });

    attachListener('wrong-roles-btn', function() {
        const pogresne = editor.pogresnaUloga();
        if (porukeDiv) {
            if (pogresne.length > 0) {
                porukeDiv.innerHTML = `<strong>Potencijalno pogrešne uloge:</strong><br>${formatLinesForHtml(pogresne.join('\n'))}`;
            } else {
                porukeDiv.textContent = 'Nema potencijalno pogrešnih uloga';
            }
        }
    });

    attachListener('lines-count-btn', function() {
        const uloga = prompt('Unesite ime uloge:');
        if (uloga) {
            const brojLinija = editor.brojLinijaTeksta(uloga);
            if (porukeDiv) porukeDiv.textContent = `Uloga "${uloga.toUpperCase()}" ima ${brojLinija} linija teksta`;
        }
    });

    attachListener('role-scenario-btn', function() {
        const uloga = prompt('Unesite ime uloge:');
        if (uloga) {
            const scenarij = editor.scenarijUloge(uloga);
            if (porukeDiv) {
                if (scenarij.length > 0) {
                    let output = `<strong>Scenarij za ulogu "${uloga.toUpperCase()}":</strong><br>`;
                    scenarij.forEach((stavka, index) => {
                        output += `<br><strong>--- Replika ${index + 1} ---</strong><br>`;
                        output += `Scena: ${formatLinesForHtml(stavka.scena)}<br>`;
                        output += `Pozicija u sceni (replika): ${stavka.pozicijaUTekstu}<br>`;
                        
                        output += `<br><em>Prethodni:</em><br>`;
                        if (stavka.prethodni) {
                            output += `Uloga: ${stavka.prethodni.uloga}<br>`;
                            output += `Tekst: ${formatLinesForHtml(stavka.prethodni.linije)}<br>`; 
                        } else {
                            output += `Nema prethodne replike (otvara dijalog-segment)<br>`;
                        }
                        
                        output += `<br><em>Trenutni:</em><br>`;
                        output += `Uloga: ${stavka.trenutni.uloga}<br>`;
                        output += `Tekst: ${formatLinesForHtml(stavka.trenutni.linije)}<br>`; 
                        
                        output += `<br><em>Sljedeći:</em><br>`;
                        if (stavka.sljedeci) {
                            output += `Uloga: ${stavka.sljedeci.uloga}<br>`;
                            output += `Tekst: ${formatLinesForHtml(stavka.sljedeci.linije)}<br>`; 
                        } else {
                            output += `Nema sljedeće replike (zatvara dijalog-segment)<br>`;
                        }
                    });
                    porukeDiv.innerHTML = output;
                } else {
                    porukeDiv.textContent = `Nema scenarija za ulogu "${uloga.toUpperCase()}"`;
                }
            }
        }
    });

    attachListener('group-roles-btn', function() {
        const grupe = editor.grupisiUloge();
        if (porukeDiv) {
            if (grupe.length > 0) {
                let output = `<strong>Grupisane uloge po dijalog-segmentima:</strong><br>`;
                grupe.forEach(grupa => {
                    output += `<br>Scena: ${formatLinesForHtml(grupa.scena)}<br>`;
                    output += `Segment: ${grupa.segment}<br>`;
                    output += `Uloge: ${grupa.uloge.join(', ')}<br>`;
                });
                porukeDiv.innerHTML = output;
            } else {
                porukeDiv.textContent = 'Nema grupa uloga';
            }
        }
    });

    function ucitajScenario(isManual = false) {
        if (!window.SCENARIO_ID) return;

        PoziviAjaxFetch.getScenario(window.SCENARIO_ID, (status, data) => {
            if (status === 200) {
                editorDiv.innerHTML = "";
                
            
                if (pDivLock) {
                    pDivLock.innerText = isManual ? 
                        ` Scenarij "${data.title}" uspješno učitan!` : 
                        `Učitan scenarij: ${data.title}`;
                    pDivLock.style.color = "green";
                }

                if (data.content && data.content.length > 0) {
                    data.content.forEach(linija => {
                        const p = document.createElement('p');
                        p.setAttribute('data-line-id', linija.lineId);
                        p.innerText = linija.text;
                        editorDiv.appendChild(p);
                    });
                }
                
             
                lastTimestamp = Math.floor(Date.now() / 1000);
            } else {
                if (pDivLock) {
                    pDivLock.innerText = " Greška: " + (data.message || "Scenario nije pronađen.");
                    pDivLock.style.color = "red";
                }
            }
        });
    }

    function provjeriPromjene() {
        if (!window.SCENARIO_ID) return;

        PoziviAjaxFetch.getDeltas(window.SCENARIO_ID, lastTimestamp, (status, data) => {
     
            if (status === 200 && data.deltas && data.deltas.length > 0) {
                console.log("Pronađene promjene na serveru, osvježavam...");
                ucitajScenario(false);
   
                lastTimestamp = data.deltas[data.deltas.length - 1].timestamp;
            }
        });
    }

    function pokreniAutoRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(provjeriPromjene, REFRESH_RATE);
    }




 

    attachListener('btn-load-scenario', () => {
        const id = document.getElementById('odabir-scenarija').value;
        if (id) {
            window.SCENARIO_ID = id;
            ucitajScenario(true);
            pokreniAutoRefresh();
        }
    });

    attachListener('create-scenario-btn', () => {
        const naslov = prompt("Unesite naslov novog scenarija:");
        if (naslov) {
            PoziviAjaxFetch.postScenario(naslov, (status, data) => {
                if (status === 200) {
                    if (porukeDiv) porukeDiv.textContent = `Kreiran scenario ID: ${data.id}`;
                    window.SCENARIO_ID = data.id;
                    ucitajScenario(true);
                    pokreniAutoRefresh();
                }
            });
        }
    });

    attachListener('btn-edit-line', () => {
        const lineId = document.getElementById('input-line-id').value;
        if (!lineId || !window.SCENARIO_ID) return;

        PoziviAjaxFetch.lockLine(window.SCENARIO_ID, lineId, USER_ID, (status, data) => {
            if (status === 200) {
                document.getElementById('current-editing-id').innerText = lineId;
                if (pDivLock) {
                    pDivLock.innerText = data.message;
                    pDivLock.style.color = "green";
                }
             
                const paragraphs = editorDiv.querySelectorAll('p');
                paragraphs.forEach(p => {
                    if (p.getAttribute('data-line-id') == lineId) {
                        document.getElementById('textarea-edit').value = p.innerText;
                    }
                });
            } else {
                if (pDivLock) {
                    pDivLock.innerText = data.message;
                    pDivLock.style.color = "red";
                }
            }
        });
    });

    attachListener('btn-save-line', () => {
        const lineId = document.getElementById('current-editing-id').innerText;
        const noviTekst = document.getElementById('textarea-edit').value;
        if (lineId === "---" || !window.SCENARIO_ID) return;

        PoziviAjaxFetch.updateLine(window.SCENARIO_ID, lineId, USER_ID, [noviTekst], (status, data) => {
            if (status === 200) {
                if (pDivLock) {
                    pDivLock.innerText = data.message;
                    pDivLock.style.color = "green";
                }
                document.getElementById('current-editing-id').innerText = "---";
                document.getElementById('textarea-edit').value = "";
                ucitajScenario();
            } else {
                if (pDivLock) {
                    pDivLock.innerText = data.message;
                    pDivLock.style.color = "red";
                }
            }
        });
    });

    attachListener('btn-lock-character', () => {
        const charName = document.getElementById('input-character-name').value.trim();
        if (charName && window.SCENARIO_ID) {
            PoziviAjaxFetch.lockCharacter(window.SCENARIO_ID, charName, USER_ID, (status, data) => {
                if (pDivLock) {
                    pDivLock.innerText = data.message;
                    pDivLock.style.color = (status === 200) ? "green" : "red";
                }
            });
        }
    });

    attachListener('btn-update-character', () => {
        const oldName = document.getElementById('input-character-name').value.trim();
        const newName = document.getElementById('input-new-name').value.trim();
        if (oldName && newName && window.SCENARIO_ID) {
            PoziviAjaxFetch.updateCharacter(window.SCENARIO_ID, USER_ID, oldName, newName, (status, data) => {
                if (pDivLock) {
                    pDivLock.innerText = data.message;
                    pDivLock.style.color = (status === 200) ? "green" : "red";
                }
                if (status === 200) ucitajScenario();
            });
        }
    });

}); 