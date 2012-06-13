(function () {
    "use strict";
    
    var Jscex;
    
    var _ = (function () {
    
        var isArray = function (obj) {
            return Object.prototype.toString.call(obj) === '[object Array]';
        }
    
        var each = function (obj, action) {
            if (isArray(obj)) {
                for (var i = 0, len = obj.length; i < len; i++) {
                    var value = action(i, obj[i]);
                    if (value !== undefined)
                        return value;
                }
            } else {
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        var value = action(key, obj[key]);
                        if (value !== undefined)
                            return value;
                    }
                }
            }
        }
        
        var map = function (obj, mapper, valueMapper) {
            if (isArray(obj)) {
                var array = new Array(obj.length);
                for (var i = 0, len = obj.length; i < len; i++) {
                    array[i] = mapper(obj[i]);
                }
                return array;
            } else {
                var newObj = {};
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        var value = obj[key];
                        var newKey = mapper ? mapper(key) : key;
                        var newValue = valueMapper ? valueMapper(value) : value;
                        newObj[newKey] = newValue;
                    }
                }
                return newObj;
            }
        }
        
        var v2n = function (version) {
            var value = 0;
            
            var parts = version.split(".");
            for (var i = 0; i < 3; i++) {
                value *= 100;
                if (i < parts.length) {
                    value += parseInt(parts[i], 10);
                }
            }
            
            return value;
        }
        
        var testVersion = function (expected, version) {
            var expectedMinVersion = expected.substring(1); // remove leading "~"
            
            var expectedMaxParts = expectedMinVersion.split(".");
            expectedMaxParts[expectedMaxParts.length - 1] = "0";
            expectedMaxParts[expectedMaxParts.length - 2] = (parseInt(expectedMaxParts[expectedMaxParts.length - 2], 10) + 1).toString();
            var expectedMaxVersion = expectedMaxParts.join(".");
            
            var versionNumber = v2n(version);
            return v2n(expectedMinVersion) <= versionNumber && versionNumber < v2n(expectedMaxVersion);
        }
        
        var format = function (f, args) {
            // support _.format(f, a0, a1, ...);
            if (!isArray(args)) {
                var newArgs = new Array(arguments.length - 1);
                for (var i = 1; i < arguments.length; i++) {
                    newArgs[i - 1] = arguments[i];
                }
                
                return format(f, newArgs);
            }
            
            return f.replace(/\{{1,2}\d+\}{1,2}/g, function (ph) {
                if (ph.indexOf("{{") == 0 && ph.indexOf("}}") == ph.length - 2) {
                    return ph.substring(1, ph.length - 1);
                }
                
                var left = 0;
                while (ph[left] == "{") left++;
                
                var right = ph.length - 1;
                while (ph[right] == "}") right--;
                
                var index = parseInt(ph.substring(left, right + 1), 10);
                return ph.replace("{" + index + "}", args[index]);
            });
        }
        
        var once = function (fn) {
            var called = false;
            return function () {
                if (called) return;
                fn.apply(this, arguments);
                called = true;
            }
        };
        
        return {
            isArray: isArray,
            each: each,
            map: map,
            v2n: v2n,
            testVersion: testVersion,
            format: format,
            once: once
        };
    })();

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
    
    var executeWithCurrentDirInModulePaths = function (action) {

        var dirname = (typeof __dirname === "string") ? __dirname : null;

        var modulePaths;
        if (dirname) {
            try {
                modulePaths = require.paths;
            } catch (err) {
                try {
                    modulePaths = module.paths;
                } catch (err) { }
            }
        }
        
        if (modulePaths && dirname) {
            try {
                // try to load module from current path
                modulePaths.unshift(dirname); 
            } catch (err) { }
        }
        
        try {
            action();
        } finally {
            if (modulePaths && dirname) {
                try {
                    // restore the load paths
                    modulePaths.shift(dirname);
                } catch (err) { }
            }
        }
    }
    
    var loadModules = function (require, modules) {
        if (require) {
            _.each(modules, function (i, name) {
                require("jscex-" + name).init();
            });
        } else {
            _.each(modules, function (i, m) {
                m.init();
            });
        }
    }

    var initModule = function (options) {
        if (Jscex.modules[options.name]) {
            throw new Error(_.format('Module "{0}" is already loaded, please load the module only once.', options.name));
        }
    
        checkDependencies(options);
        options.init();
        Jscex.modules[options.name] = options.version;
    }
    
    var checkDependencies = function (options) {
        var expectedCoreVersion = options.dependencies["core"];
        if (!_.testVersion(expectedCoreVersion, Jscex.coreVersion)) {
            throw new Error(_.format(
                'Version of core component mismatched, expected: "{0}", actual: "{1}".',
                expectedCoreVersion,
                Jscex.coreVersion));
        }
        
        _.each(options.dependencies, function (name, expectedVersion) {
            if (name == "core") return;
            
            var version = Jscex.modules[name];
            if (!version) {
                throw new Error(_.format(
                    'Missing required module: "{0}", expected version: "{1}".',
                    name,
                    expectedVersion));
            }
            
            if (!_.testVersion(expectedVersion, version)) {
                throw new Error(_.format(
                    'Version of module "{0}" mismatched, expected: "{1}", actual: "{2}".',
                    name,
                    expectedVersion,
                    version));
            }
        });
    }
    
    var exportBasicOptions = function (exports, options) {
        exports.name = options.name;
        exports.version = options.version;
    }

    // CommonJS
    var isCommonJS = !!(typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommonJS AMD
    var isAmd = !!(typeof require === "function" && typeof define === "function" && define.amd);
    
    var defineModule = function (options) {
        var autoloads = options.autoloads || [];

        if (isCommonJS) {
            exportBasicOptions(options.exports, options);
            options.exports.init = _.once(function () {
                executeWithCurrentDirInModulePaths(function () {
                    loadModules(options.require, autoloads);
                });
                initModule(options);
            });
        } else if (isAmd) {
            var dependencies = _.map(autoloads, function (name) { return "jscex-" + name; });
            
            define("jscex-" + options.name, dependencies, function () {
                var loadedModules = arguments;
                
                var exports = {};
                exportBasicOptions(exports, options);
                exports.init = _.once(function () {
                    loadModules(null, loadedModules);
                    initModule(options);
                });

                return exports;
            });
        } else {
            initModule(options);
        }
    }

    defineModule.cjs = isCommonJS;
    defineModule.amd = isAmd;

    var init = function () {
        Jscex.coreVersion = "0.6.5";
        
        Jscex.logger = new Logger();
        Jscex.Logging = {
            Logger: Logger,
            Level: Level
        };

        Jscex._ = _;
        Jscex.modules = { };
        Jscex.binders = { };
        Jscex.builders = { };
        Jscex.define = defineModule;
    };
    
    if (isCommonJS) {
        Jscex = module.exports;
        init();
    } else if (isAmd) {
        define("jscex", function () {
            Jscex = { };
            init();
            return Jscex;
        });
    } else {
        // Get the global object.
        var Fn = Function, global = Fn('return this')();
    
        if (global.Jscex) {
            throw new Error("There's already a Jscex root here, please load the component only once.");
        }
        
        Jscex = global.Jscex = { };
        init();
    }
})();