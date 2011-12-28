(function () {
    
    var isCommonJS = (typeof require !== "undefined" && typeof module !== "undefined" && module.exports);
    var isAmd = (typeof define !== "undefined" && define.amd);
    
    var root;
    
    if (isCommonJS) {
        root = module.exports;
    } else if (isAmd) {
        root = { };
    } else {
        if (typeof Jscex == "undefined") {
            /* defined Jscex in global */
            Jscex = { };
        }
        
        root = Jscex;
    }

    root.modules = { };
    root.binders = { };
    root.builders = { };
    root.log = function (text) {
        try { console.log(text); }
        catch (ex) { }
    };
    
    if (isAmd) {
        define("jscex", function () {
            return root;
        });
    }
})();
