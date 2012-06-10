"use strict";

require("should");

var Jscex = require("../src/jscex");

describe("underscore", function () {

    var _ = Jscex._;

    describe("isArray", function () {
    
        it("should return true for array", function () {
            _.isArray([]).should.equal(true);
        });
        
        it("should return false for others", function () {
            _.isArray("").should.equal(false);
            _.isArray(1).should.equal(false);
            _.isArray({}).should.equal(false);
        });
        
    });
    
    describe("each", function () {
    
        it("should iterate all array items", function () {
            var obj = {};
            
            _.each([1, 2, 3], function (i, v) { obj["i" + i] = v; });
            
            obj.should.eql({ i0: 1, i1: 2, i2: 3 });
        });
        
        it("should break the array iteration when get a value", function () {
            var obj = {};
            
            var value = _.each([1, 2, 3, 4, 5], function (i, v) {
                obj["i" + i] = v;
                if (v == 3) return "Hello World";
            });
            
            value.should.equal("Hello World");
            obj.should.eql({ i0: 1, i1: 2, i2: 3 });
        });
        
        it("should iterate all map items", function () {
            var obj = {};
            
            _.each({ a: 1, b: 2, c: 3 }, function (k, v) { obj["k" + k] = v; });
            
            obj.should.eql({ ka: 1, kb: 2, kc: 3 });
        });
        
        it("should break the map iteration when get a value", function () {
            var obj = {};
            
            var value = _.each({ a: 1, b: 2, c: 3, d: 4, e: 5 }, function (k, v) {
                obj["k" + k] = v;
                if (v == 3) return "Hello World";
            });
            
            value.should.equal("Hello World");
            obj.should.eql({ ka: 1, kb: 2, kc: 3 });
        });
        
        it("should treat return as continue in loop", function () {
            var obj = {};
            
            _.each({ a: 1, b: 2, c: 3, d: 4 }, function (k, v) {
                if (v == 3) return;
                obj["k" + k] = v;
            });
            
            obj.should.eql({ ka: 1, kb: 2, kd: 4 })
        });
    });

    describe("v2n", function () {
        it("should get number for simple version string", function () {
            _.v2n("1.2.3").should.equal(10203);
            _.v2n("10.2").should.equal(100200);
        });
    });
    
    describe("testVersion", function () {
        it("should return true if equals to the min version", function () {
            _.testVersion("~1.5.0", "1.5.0").should.equal(true);
        });
        
        it("should return true if has higher minor revision", function () {
            _.testVersion("~1.5.0", "1.5.99").should.equal(true);
        });
        
        it("should return false if has less minor revision", function () {
            _.testVersion("~1.5.0", "1.4.0").should.equal(false);
        });
        
        it("should return false if equals to the next major revision", function () {
            _.testVersion("~1.5.0", "1.6.0").should.equal(false);
        });
    });
    
    describe("format", function () {
        it("should get formatted string in normal case", function () {
            _.format("{0}, {1}, {0}, {2}", 1, 2, 3).should.equal("1, 2, 1, 3");
            _.format("{0}, {1}, {0}, {2}", [1, 2, 3]).should.equal("1, 2, 1, 3");
            _.format("{0}, {1}, {{0}, {2}", 1, 2, 3).should.equal("1, 2, {1, 3");
        });
        
        it("should keep unformatted string if braces are escaped", function () {
            _.format("{0}, {1}, {{0}}, {2}", 1, 2, 3).should.equal("1, 2, {0}, 3");
        });
    });
});

describe("define (in CommonJS)", function () {
    
    var Root = function (version) {
        this.coreVersion = version;
        
        this._ = Jscex._;
        this.modules = { };
        this.binders = { };
        this.builders = { };
    }
    
    var executeWithRequireMock = function (requireMock, action) {
        var rawRequire = require;
        require = requireMock;
        
        try {
            action();
        } finally {
            require = rawRequire;
        }
    }
    
    it("should be work with executeWithRequireMock", function () {
        require.should.not.equal("hello");
        executeWithRequireMock("hello", function () {
            require.should.equal("hello");
        });
        require.should.not.equal("hello");
    });
    
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

