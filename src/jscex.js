(function () {

    var Level = {
        DEBUG: 1,
        INFO: 2,
        WARN: 3,
        ERROR: 4
    };

    var Logger = function () {
        this.level = Level.DEBUG;
    };
    Logger.prototype = {
        log: function (msg) {
            try { console.log(msg); } catch (ex) { }
        },

        debug: function (msg) {
            if (this.level <= Level.DEBUG) {
                this.log(msg);
            }
        },

        info: function (msg) {
            if (this.level <= Level.INFO) {
                this.log(msg);
            }
        },

        warn: function (msg) {
            if (this.level <= Level.WARN) {
                this.log(msg);
            }
        },

        error: function (msg) {
            if (this.level <= Level.ERROR) {
                this.log(msg);
            }
        }
    };

    // CommonJS
    var isCommonJS = (typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommongJS Wrapping
    var isWrapping = (typeof define === "function" && !define.amd);
    // CommonJS AMD
    var isAmd = (typeof require === "function" && typeof define === "function" && define.amd);
    
    var root;
    
    if (isCommonJS) {
        root = module.exports;
    } else if (isWrapping || isAmd) {
        root = { };
        define("jscex", function (require) {
            return root;
        });
    } else {
        if (typeof Jscex == "undefined") {
            /* defined Jscex in global */
            Jscex = { };
        }
        
        root = Jscex;
    }

    root._forInKeys = function (obj) {
        var keys = [];
        for (var k in obj) {
            keys.push(k);
        }

        return keys;
    };

    root.Logging = {
        Logger: Logger,
        Level: Level
    };

    root.logger = new Logger();
    root.modules = { };
    root.binders = { };
    root.builders = { }; 
})();
