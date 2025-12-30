const PoziviAjaxFetch = (function() {
    const fnCallback = (promise, callback) => {
    promise.then(res => {
        
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            res.json().then(data => callback(res.status, data));
        } else {
         
            callback(res.status, { message: "Server nije vratio JSON odgovor." });
        }
    }).catch(err => {
      
        callback(500, { message: "Greška." });
    });
};

    return {
        postScenario: (title, callback) => fnCallback(fetch('/api/scenarios', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({title})
        }), callback),
        getScenario: (id, callback) => fnCallback(fetch(`/api/scenarios/${id}`), callback),
       lockLine: (sId, lId, uId, callback) => fnCallback(fetch(`/api/scenarios/${sId}/lines/${lId}/lock`, {
    method: 'POST', 
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify({userId: uId})
}), callback),
        updateLine: (sId, lId, uId, text, callback) => fnCallback(fetch(`/api/scenarios/${sId}/lines/${lId}`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId: uId, newText: text})
        }), callback),
       
    
   
        lockCharacter: (sId, charName, uId, callback) => fnCallback(fetch(`/api/scenarios/${sId}/characters/lock`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                userId: uId,
                characterName: charName
            })
        }), callback),
        updateCharacter: (sId, uId, oldN, newN, callback) => fnCallback(fetch(`/api/scenarios/${sId}/characters/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        userId: uId,
        oldName: oldN,
        newName: newN
    })
}), callback),
getDeltas: (scenarioId, since, callback) => fnCallback(
    fetch(`/api/scenarios/${scenarioId}/deltas?since=${since}`), 
    callback
),
    };
})();