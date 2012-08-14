(function () {
    "use strict";
    
    var Wind;
    
    var _ = (function () {
    
        var isArray = function (obj) {
            return Object.prototype.toString.call(obj) === '[object Array]';
        }
    
        var each = function (obj, action) {
            if (isArray(obj)) {
                for (var i = 0, len = obj.length; i < len; i++) {
                    var value = action.length === 1 ? action(obj[i]) : action(i, obj[i]);
                    if (value !== undefined)
                        return value;
                }
            } else {
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        var value = action.length === 1 ? action(obj[key]) : action(key, obj[key]);
                        if (value !== undefined)
                            return value;
                    }
                }
            }
        }
        
        var isEmpty = function (obj) {
            if (isArray(obj)) {
                return obj.length === 0;
            }
            
            return !(_.each(obj, function (v) { return true; }));
        }
        
        var map = function (obj, mapper, valueMapper) {
            if (isArray(obj)) {
                var array = new Array(obj.length);
                for (var i = 0, len = obj.length; i < len; i++) {
                    array[i] = mapper(obj[i]);
                }
                return array;
            } else {
                var keyMapper = valueMapper ? mapper : null;
                valueMapper = valueMapper || mapper;
                
                var newObj = {};
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        var value = obj[key];
                        var newKey = keyMapper ? keyMapper(key) : key;
                        var newValue = valueMapper ? valueMapper(value) : value;
                        newObj[newKey] = newValue;
                    }
                }

                return newObj;
            }
        }

        var clone = function (obj) {
            return map(obj);
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
            isEmpty: isEmpty,
            map: map,
            clone: clone,
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

    var exportBasicOptions = function (exports, options) {
        exports.name = options.name;
        exports.version = options.version;
        
        if (options.autoloads) {
            exports.autoloads = options.autoloads;
        }
        
        if (options.dependencies) {
            exports.dependencies = options.dependencies;
        }
    }
    
    var initModule = function (options) {
        var existingModule = Wind.modules[options.name];
        if (existingModule && existingModule.version != options.version) {
            Wind.logger.warn(_.format(
                'The module "{0}" with version "{1}" has already been initialized, skip version "{2}".',
                options.name,
                existingModule.version,
                options.version));
        }

        checkDependencies(options);
        options.init();
        
        var module = {};
        exportBasicOptions(module, options);
        Wind.modules[options.name] = module;
    }
    
    var checkDependencies = function (options) {
        _.each(options.dependencies || [], function (name, expectedVersion) {
            var module = Wind.modules[name];
            if (!module) {
                throw new Error(_.format(
                    'Missing required module: "{0}" (expected version: "{1}").',
                    name,
                    expectedVersion));
            }

            if (!_.testVersion(expectedVersion, module.version)) {
                throw new Error(_.format(
                    'Version of module "{0}" mismatched, expected: "{1}", actual: "{2}".',
                    name,
                    expectedVersion,
                    module.version));
            }
        });
    }

    // CommonJS
    var isCommonJS = !!(typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommonJS AMD
    var isAmd = !!(typeof require === "function" && typeof define === "function" && define.amd);
    
    var defineModule = function (options) {
        var autoloads = options.autoloads || [];

        if (isCommonJS) {
            var require = options.require;
            _.each(autoloads, function (name) {
                try {
                    require("./wind-" + name);
                } catch (ex) {
                    require("wind-" + name);
                }
            });
            
            initModule(options);
        } else if (isAmd) {
            var dependencies = _.map(autoloads, function (name) { return "wind-" + name; });
            define("wind-" + options.name, dependencies, function () {
                if (options.onerror) {
                    try {
                        initModule(options);
                    } catch (ex) {
                        options.onerror(ex);
                    }
                } else {
                    initModule(options);
                }
            });
        } else {
            initModule(options);
        }
    }

    var init = function () {
        Wind.logger = new Logger();
        Wind.Logging = {
            Logger: Logger,
            Level: Level
        };

        Wind._ = _;
        Wind.modules = { core: { name: "core", version: "0.7.0" } };
        Wind.binders = { };
        Wind.builders = { };
        Wind.define = defineModule;
    };
    
    if (isCommonJS) {
        Wind = module.exports;
        init();
    } else if (isAmd) {
        define("wind-core", function () {
            Wind = { };
            init();
            return Wind;
        });
    } else {
        // Get the global object.
        var Fn = Function, global = Fn('return this')();
    
        if (global.Wind) {
            throw new Error("There's already a Wind root here, please load the component only once.");
        }
        
        Wind = global.Wind = { };
        init();
    }
})();