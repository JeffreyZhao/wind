(function () {

    // CommonJS
    var isCommonJS = !!(typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommongJS Wrapping
    var isWrapping = !!(typeof define === "function" && !define.amd);
    // CommonJS AMD
    var isAmd = !!(typeof require === "function" && typeof define === "function" && define.amd); 
    
    var init = (function () {
        "use strict";
    
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
            
            return {
                isArray: isArray,
                each: each,
                map: map,
                v2n: v2n,
                testVersion: testVersion,
                format: format
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
        
        var loadModules = function (root, require, modules) {
            if (require) {
                _.each(modules, function (i, name) {
                    if (!root.modules[name]) {
                        require("jscex-" + name).init(root);
                    }
                });
            } else {
                _.each(modules, function (i, m) {
                    if (!root.modules[m.name]) {
                        m.init(root);
                    }
                });
            }
        }
        
        var initModule = function (root, options) {
            checkDependencies(root, options);
            options.init(root);
            root.modules[options.name] = options.version;
        }
        
        var checkDependencies = function (root, options) {
            var expectedCoreVersion = options.dependencies["core"];
            if (!_.testVersion(expectedCoreVersion, root.coreVersion)) {
                throw new Error(_.format(
                    'Version of core component mismatched, expected: "{0}", actual: "{1}".',
                    expectedCoreVersion,
                    root.coreVersion));
            }
            
            _.each(options.dependencies, function (name, expectedVersion) {
                if (name == "core") return;
                
                var version = root.modules[name];
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
        
        var defineModule = function (options) {
            var autoloads = options.autoloads || [];

            if (isCommonJS) {
                exportBasicOptions(options.exports, options);
                options.exports.init = function (root) {
                    executeWithCurrentDirInModulePaths(function () {
                        loadModules(root, options.require, autoloads);
                    });
                    
                    initModule(root, options);
                }
            } else if (isWrapping) {
                var dependencies = _.map(autoloads, function (name) { return "jscex-" + name; });
                define("jscex-" + options.name, dependencies, function (require, exports, module) {
                    exportBasicOptions(exports, options);
                    exports.init = function (root) {
                        loadModules(root, require, autoloads);
                        initModule(root, options);
                    };
                });
            } else if (isAmd) {
                var dependencies = _.map(autoloads, function (name) { return "jscex-" + name; });
                define("jscex-" + options.name, dependencies, function () {
                    var loadedModules = arguments;
                    var exports = {
                        init: function (root) {
                            loadModules(root, null, loadedModules);
                            initModule(root, options);
                        }
                    };
                    exportBasicOptions(exports, options);
                    return exports;
                });
            } else {
                if (typeof Jscex === "undefined") {
                    throw new Error('Missing the root object, please load "jscex" module first.');
                }
                
                initModule(Jscex, options);
            }
        }
        
        defineModule.cjs = isCommonJS;
        defineModule.amd = isAmd;
        
        return function (root) {
            root.coreVersion = "0.6.5";
            
            root.logger = new Logger();
            root.Logging = {
                Logger: Logger,
                Level: Level
            };

            root._ = _;
            root.modules = { };
            root.binders = { };
            root.builders = { };
            root.define = defineModule;
        };
    })();
    
    if (!isCommonJS && !isWrapping && !isAmd) {
        if (typeof Jscex == "undefined") {
            /* defined Jscex in global */
            Jscex = { };
        }
        
        init(Jscex);
    } else {
        "use strict";
        
        if (isCommonJS) {
            init(module.exports);
        } else if (isWrapping) {
            define("jscex", function (require, exports, module) {
                init(exports);
            });
        } else if (isAmd) {
            define("jscex", function () {
                var root = {};
                init(root);
                return root;
            });
        }
    }
})();