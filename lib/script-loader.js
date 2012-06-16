function loadScript(path, callback) {
    var script = document.createElement("script");
    if (script.onload == null) {
        script.onload = function () {
            callback();
        }
    } else if (script.onreadystatechange == null){
        script.onreadystatechange = function () {
            if (this.readyState == "load") {
                callback();
            }
        }
    }
    
    script.src = path;
    document.getElementsByTagName("head")[0].appendChild(script); 
}