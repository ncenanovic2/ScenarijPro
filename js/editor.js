document.addEventListener('DOMContentLoaded', function() {
    const editorDiv = document.getElementById('text-editor');
    const porukeDiv = document.getElementById('poruke');
    
    if (!editorDiv) {
        console.error('Nedostaje div element sa id="text-editor". Editor se ne može inicijalizovati.');
        return;
    }
    
    let editor;
    try {
        editor = EditorTeksta(editorDiv); 
        console.log('Editor uspješno inicijaliziran');
    } catch (error) {
        const errorMessage =  error.message;
        console.error(errorMessage);
        if (porukeDiv) {
            porukeDiv.textContent = errorMessage;
        }
        return; 
    }

  
    const attachListener = (id, handler) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', handler);
        } else {
            console.warn(`Dugme sa ID-jem '${id}' nedostaje u HTML-u. Funkcionalnost neće biti dostupna.`);
        }
    };

    // Funkcija za zamjenu \n sa <br>
    const formatLinesForHtml = (text) => text ? text.replace(/\n/g, '<br>') : '';


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
});