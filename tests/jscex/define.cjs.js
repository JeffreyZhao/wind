"use strict";

var Jscex = require("../../src/jscex");
require("chai").should();

describe("define (CommonJS)", function () {
    
    it("should be true for the 'cjs' mark", function () {
        Jscex.define.cjs.should.equal(true);
    });
    
    it("should be false for the 'amd' mark", function () {
        Jscex.define.amd.should.equal(false);
    });
    
    var Root = function (version) {
        this.coreVersion = version;
        
        this._ = Jscex._;
        this.modules = { };
        this.binders = { };
        this.builders = { };
    }
    
    it("should support simple module", function () {
        var exports = {};
        
        Jscex.define({
            name: "test",
            version: "0.5.0",
            exports: exports,
            dependencies: { core: "~0.5.0" },
            init: function (root) {
                root.hello = "world";
            }
        });
        
        exports.name.should.equal("test");
        exports.version.should.equal("0.5.0");

        var root = new Root("0.5.0");
        exports.init(root);
        
        root.hello.should.equal("world");
        root.modules["test"] = "0.5.0";
    });
    
    it("should support complicated module", function () {
        var loaded = [];
        var require = function (name) {
            return {
                init: function (root) {
                    loaded.push(name);
                }
            };
        }
        
        var root = new Root("0.5.0");
        root.modules["d0"] = "0.1.0";
        root.modules["d1"] = "0.2.5";
        
        var exports = {};
        
        Jscex.define({
            name: "test",
            version: "0.8.0",
            exports: exports,
            require: require,
            autoloads: ["m0", "m1"],
            dependencies: {
                "core": "~0.5.0",
                "d0": "~0.1.0",
                "d1": "~0.2.0"
            },
            init: function (root) {
                root.hello = "world";
            }
        });

        exports.init(root);
        
        loaded.should.eql(["jscex-m0", "jscex-m1"]);
        root.hello.should.equal("world");
        root.modules["test"] = "0.8.0";
    });

    it("should throw if module required an invalid core version", function () {
        var root = new Root("0.5.0");

        var exports = {};
        
        Jscex.define({
            name: "test",
            version: "0.9.0",
            exports: exports,
            dependencies: { "core": "~0.6.0" },
            init: function (root) {
                root.hello = "world";
            }
        });
        
        (function () {
            exports.init(root);
        }).should.throw();
    });
    
    it("should throw if required module is not loaded", function () {
        var root = new Root("0.5.0");

        var exports = {};
        
        Jscex.define({
            name: "test",
            version: "0.9.0",
            exports: exports,
            dependencies: {
                "core": "~0.5.0",
                "d0": "~0.1.0"
            },
            init: function (root) {
                root.hello = "world";
            }
        });
        
        (function () {
            exports.init(root);
        }).should.throw();
    });
    
    it("should throw if the required module is loaded but has invalid version", function () {
        var root = new Root("0.5.0");
        root.modules["d0"] = "0.2.0";

        var exports = {};
        
        Jscex.define({
            name: "test",
            version: "0.9.0",
            exports: exports,
            dependencies: {
                "core": "~0.5.0",
                "d0": "~0.1.0"
            },
            init: function (root) {
                root.hello = "world";
            }
        });
        
        (function () {
            exports.init(root);
        }).should.throw();
    });
});