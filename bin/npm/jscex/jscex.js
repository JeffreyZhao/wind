(function () {

    var Level = {
        ALL: 0,
        TRACE: 1,
        DEBUG: 2,
        INFO: 3,
        WARN: 4,
        ERROR: 5,
        OFF: 100
    };

    var Logger = function () {
        this.level = Level.DEBUG;
    };
    Logger.prototype = {
        log: function (level, msg) {
            if (this.level <= level) {
                try { console.log(msg); } catch (ex) { }
            }
        },

        trace: function (msg) {
            this.log(Level.TRACE, msg);
        },

        debug: function (msg) {
            this.log(Level.DEBUG, msg);
        },

        info: function (msg) {
            this.log(Level.INFO, msg);
        },

        warn: function (msg) {
            this.log(Level.WARN, msg);
        },

        error: function (msg) {
            this.log(Level.ERROR, msg);
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