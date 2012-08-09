(function () {

    var init = function (root) {
        if (root.modules["async-include"]) {
            return;
        }
        
        if (!root.modules["async"]) {
            throw new Error('Missing essential components, please initialize "wind-async" module first.');
        }
        

        root.modules["async-include"] = true;

        var Async = root.Async;
        var Task = Async.Task
        Async.include = function (path) {
            return Task.create(function (t) {
                var script = document.createElement("script");
                if(script.onload == null) {
                    script.onload = function () {
                        t.complete("success");
                    }
                }
                else if(script.onreadystatechange == null){
                    script.onreadystatechange = function () {
                        if(this.readyState=='load')
                            t.complete("success");
                    }
                }
                script.src = path;
                
                document.getElementsByTagName("head")[0].appendChild(script);                

            });

        }
    }    
    // CommonJS
    var isCommonJS = (typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommongJS Wrapping
    var isWrapping = (typeof define === "function" && !define.amd);
    // CommonJS AMD
    var isAmd = (typeof require === "function" && typeof define === "function" && define.amd);
    
    if (isCommonJS) {
        module.exports.init = init;
    } else if (isWrapping) {
        define("wind-async-include", ["wind-async"], function (require, exports, module) {
            module.exports.init = init;
        });
    } else if (isAmd) {
        define("wind-async-include", ["wind-async"], function () {
            return { init: init };
        });
    } else {
        if (typeof Wind === "undefined") {
            throw new Error('Missing the root object, please load "wind" module first.');
        }
    
        init(Wind);
    }
})();
