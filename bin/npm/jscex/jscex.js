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
        log: function (level, msg) {
            try { console.log(msg); } catch (ex) { }
        },

        debug: function (msg) {
            if (this.level <= Level.DEBUG) {
                this.log(Level.DEBUG, msg);
            }
        },

        info: function (msg) {
            if (this.level <= Level.INFO) {
                this.log(Level.INFO, msg);
            }
        },

        warn: function (msg) {
            if (this.level <= Level.WARN) {
                this.log(Level.WARN, msg);
            }
        },

        error: function (msg) {
            if (this.level <= Level.ERROR) {
                this.log(Level.ERROR, msg);
            }
        }
    };
        
    var init = function (root) {

        root.Logging = {
            Logger: Logger,
            Level: Level
        };

        root.logger = new Logger();
        root.modules = { };
        root.binders = { };
        root.builders = { }; 
    };

    // CommonJS
    var isCommonJS = (typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommongJS Wrapping
    var isWrapping = (typeof define === "function" && !define.amd);
    // CommonJS AMD
    var isAmd = (typeof require === "function" && typeof define === "function" && define.amd);
    
    if (isCommonJS) {
        init(module.exports);
    } else if (isWrapping) {
        define("jscex", function (require, exports, module) {
            init(module.exports);
        });
    } else if (isAmd) {
        define("jscex", function () {
            var root = {};
            init(root);
            return root;
        });
    } else {
        if (typeof Jscex == "undefined") {
            /* defined Jscex in global */
            Jscex = { };
        }
        
        init(Jscex);
    }
})();
