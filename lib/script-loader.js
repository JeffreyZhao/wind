function loadScript(path, callback) {
    var script = document.createElement('script');
    // ie9 同时支持 onreadystatechange 和 onload
    if (script.onreadystatechange) {
        script.onreadystatechange = function() {
            var st = script.readyState;
            if (st === 'loaded' || st === 'complete') {
                callback();
                // 清空，以免执行 2 次
                script.onreadystatechange = null;
            }
        };
    } else {
        script.onload = function() {
            callback();
        };
    }

    script.src = path;
    document.getElementsByTagName('head')[0].appendChild(script);
}
