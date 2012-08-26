"use strict";

var exports = (typeof window === "undefined") ? module.exports : window;

exports.setupTests = function (Wind) {

    Wind.logger.level = Wind.Logging.Level.WARN;

    var Task = Wind.Async.Task;

    var success = function (result) {
        return Task.create(function (t) {
            t.complete("success", result);
        });
    };

    var failure = function (error) {
        return Task.create(function (t) {
            t.complete("failure", error);
        });
    }

    var delay = function (timeout, error, result) {
        return Task.create(function (t) {
            setTimeout(function () {
                if (error) {
                    t.complete("failure", error);
                } else {
                    t.complete("success", result);
                }
            }, timeout);
        });
    }

    should.be.constructor.prototype.nothing = function (value) {
        if (value === undefined) return;
        throw new Error("expected " + JSON.stringify(value) + " to be undefined");
    }

    // Setup unobservedTimeout
    var defaultUnobservedTimeout = Task.unobservedTimeout;

    before(function () {
        Task.unobservedTimeout = 10;
        Task.prototype.handleError = function () {
            this.on("failure", function () {
                return this.error;
            });

            return this;
        };
    });

    after(function () {
        Task.unobservedTimeout = defaultUnobservedTimeout;
        delete Task.prototype.handleError;
    });

    // unobservedError event listener
    var unobservedErrorListener;

    var handler = function () {
        unobservedErrorListener.apply(this, arguments);
    }

    beforeEach(function () {
        unobservedErrorListener = function () {
            throw new Error("The unobservedError event listener shouldn't be called.");
        };

        Task.on("unobservedError", handler);
    });

    afterEach(function () {
        Task.off("unobservedError", handler);
        unobservedErrorListener = null;
    });


    describe("Task", function () {

        describe("start", function () {

            it("shouldn't throw but work as normal error with failed delegate", function () {
                var error = new Error();
                var task = new Task(function () { throw error; });
                
                var obj = { };
                task.on("success", function () { obj.success = true; });
                task.on("failure", function () { obj.failure = true; });
                task.on("complete", function () { obj.complete = true; });
                
                task.start().status.should.equal("faulted");
                task.error.should.equal(error);

                should.be.nothing(obj.success); 
                obj.failure.should.equal(true);
                obj.complete.should.equal(true);
            });
            
            it("shouldn't throw but print warning when the task is complete then failed immediately", function () {
                var task = new Task(function (t) {
                    t.complete("success", 10);
                    throw new Error();
                });

                var logLevel = "";
                Wind.logger.log = function (level, msg) { logLevel = level; }

                try {
                    task.start().status.should.equal("succeeded");
                    task.result.should.equal(10);
                    logLevel.should.equal(Wind.Logging.Level.WARN);
                } finally {
                    delete Wind.logger.log;
                }
            });

            it("should throw if the error of task is not observed by complete event and unobservedError event", function (done) {
                var error = new Error("the error");

                var completeFired = false;

                var task = Task.create(function (t) {
                    setTimeout(function () {
                        t.complete("failure", error);
                    }, 0);
                });

                task.on("complete", function () {
                    completeFired = true;
                });

                unobservedErrorListener = function (args) {
                    args.task.should.equal(task);
                    args.error.should.equal(error);

                    completeFired.should.equal(true);

                    task.status.should.equal("faulted");
                    task.error.should.equal(error);

                    args.observed = true;

                    done();
                };
                
                task.start();
            });

            it("shouldn't trigger unobservedError event if the error is observed by complete event", function (done) {
                var error = new Error();

                var task = Task.create(function (t) {
                    setTimeout(function () {
                        t.complete("failure", error);
                    }, 0);
                });

                task.on("complete", function () {
                    this.status.should.equal("faulted");
                    this.error.should.equal(error);

                    setTimeout(done, 10);
                });

                task.start();
            });

            it("triggers unobservedError event to provide the last chance to observe the error of task", function (done) {
                var error = new Error();

                var task = Task.create(function (t) {
                    setTimeout(function () {
                        t.complete("failure", error);
                    }, 0);
                });

                unobservedErrorListener = function (args) {
                    this.should.equal(Task);
                    args.task.should.equal(task);
                    args.error.should.equal(error);

                    args.observed = true;

                    done();
                };

                task.start();
            });
        });
        
        describe("whenAll", function () {

            var whenAll = Task.whenAll;
        
            it("should directly return an empty object with an empty hash input", function () {
                whenAll({ }).start().result.should.eql({ });
            });

            it("should directly return an empty array with an empty array input", function () {
                whenAll([]).start().result.should.eql([]);
            });

            it("should directly return the result if the task is already succeeded", function () {
                var t = success(100).start();
                whenAll(t).start().result[0].should.equal(100);
            });

            it("should directly return the errors if the tasks are already faulted", function () {
                var errors = [ "error0", "error1" ];

                var t0 = failure(errors[0]).start();
                var t1 = failure(errors[1]).start();

                var aggErr = whenAll(t0, t1).start().error;
                aggErr.children.length.should.equal(2);
                aggErr.children[0].should.equal(errors[0]);
                aggErr.children[1].should.equal(errors[1]);
            });

            it("should return an array of results with a serial of tasks", function (done) {
                this.timeout(100);

                var t0 = delay(0, null, 1);
                var t1 = delay(0, null, 2);

                whenAll(t0, t1).start().addEventListener("success", function () {
                    this.result.should.eql([1, 2]);
                    done();
                });
            });

            it("should return an array of result with an array input", function (done) {
                this.timeout(100);

                var t0 = delay(0, null, 1);
                var t1 = delay(0, null, 2);

                whenAll([t0, t1]).start().addEventListener("success", function () {
                    this.result.should.eql([1, 2]);
                    done();
                });
            });

            it("should return a hash of results with a hash input", function (done) {
                this.timeout(100);

                var t0 = delay(0, null, 1);
                var t1 = delay(0, null, 2);

                whenAll({ r0: t0, r1: t1 }).start().addEventListener("success", function () {
                    this.result.should.eql({ r0: 1, r1: 2 });
                    done();
                });
            });

            it("should return the error when one of the task in array is failed", function (done) {
                this.timeout(100);

                var error = { };
                var t0 = delay(0, error, null);
                var t1 = delay(0, null, 1);

                whenAll(t0, t1).start().addEventListener("failure", function () {
                    this.error.children.length.should.equal(1);
                    this.error.children[0].should.equal(error);
                    done();
                });
            });

            it("should return the error when one of the task in hash is failed", function (done) {
                this.timeout(100);

                var error = { };
                var t0 = delay(0, null, 1);
                var t1 = delay(0, error, null);

                whenAll({ r0: t0, r1: t1 }).start().addEventListener("failure", function () {
                    this.error.children.length.should.equal(1);
                    this.error.children[0].should.equal(error);
                    done();
                });
            });

            it("should return the errors when both tasks in array are failed", function (done) {
                this.timeout(100);

                var errors = [ "error1", "error2" ];
                var t0 = delay(0, errors[0]);
                var t1 = delay(0, errors[1]);

                whenAll(t0, t1).start().addEventListener("failure", function () {
                    this.error.children.should.eql(errors);
                    done();
                });
            });

            it("should return the errors when both tasks in hash are failed", function (done) {
                this.timeout(100);

                var errors = [ "error1", "error2" ];
                var t0 = delay(0, errors[0]);
                var t1 = delay(0, errors[1]);

                whenAll({ t0: t0, t1: t1 }).start().addEventListener("failure", function () {
                    this.error.children.should.eql(errors);
                    done();
                });
            });

            it("should complete when both tasks in array are completed even the first one is failed", function (done) {
                this.timeout(100);

                var error = { };
                var t0 = delay(0, error, null);
                var t1 = delay(1, null, 10);

                whenAll(t0, t1).start().addEventListener("failure", function () {
                    t0.status.should.equal("faulted");
                    t0.error.should.equal(error);

                    t1.status.should.equal("succeeded");
                    t1.result.should.equal(10);

                    this.error.children.length.should.equal(1);
                    this.error.children[0].should.equal(error);

                    done();
                });
            });

            it("should complete when both tasks in hash are completed even the first one is failed", function (done) {
                this.timeout(100);

                var error = { };
                var t0 = delay(0, error, null);
                var t1 = delay(1, null, 10);

                whenAll({t0: t0, t1: t1}).start().addEventListener("failure", function () {
                    t0.status.should.equal("faulted");
                    t0.error.should.equal(error);

                    t1.status.should.equal("succeeded");
                    t1.result.should.equal(10);

                    this.error.children.length.should.equal(1);
                    this.error.children[0].should.equal(error);

                    done();
                });
            });

            it("should return the object graph the same as the input tasks", function (done) {
                this.timeout(100);

                var input = {
                    dataList: [
                        delay(0, null, 1),
                        {
                            hello: delay(0, null, "hello"),
                            world: delay(0, null, "world"),
                            empty: 10
                        },
                        delay(0, null, 2)
                    ],
                    value: delay(0, null, 3),
                    empty: { }
                };

                whenAll(input).start().addEventListener("success", function () {
                    this.result.should.eql({
                        dataList: [
                            1,
                            {
                                hello: "hello",
                                world: "world",
                                empty: { }
                            },
                            2
                        ],
                        value: 3,
                        empty: { }
                    });
                    done();
                });
            });
        });

        describe("whenAny", function () {
        
            var whenAny = Task.whenAny;

            it("should directly fail with an empty array or hash input", function () {
                whenAny().handleError().start().status.should.equal("faulted");
                whenAny([]).handleError().start().status.should.equal("faulted");
                whenAny({}).handleError().start().status.should.equal("faulted");
            });
            
            it("should directly return the task in the array if it's already failed", function () {
                var t0 = delay(5, "also failed!");
                var t1 = failure("failed!");
                
                var result = whenAny(t0, t1).start().result;
                result.key.should.equal(1);
                result.task.should.equal(t1);
                
                t0.status.should.equal("running");
            });
            
            it("should directly return the task in the hash if it's already succeeded", function () {
                var t0 = delay(5, "also failed!");
                var t1 = failure("failed!");
                
                var result = whenAny({"0": t0, "1": t1}).start().result;
                result.key.should.equal("1");
                result.task.should.equal(t1);
                
                t0.status.should.equal("running");
            });
            
            it("should return the task in the array which succeeded first", function (done) {
                var t0 = delay(5, null, "succeeded!");
                var t1 = delay(8, "failed!");

                whenAny(t0, t1).start().addEventListener("success", function () {
                    var result = this.result;
                    result.key.should.equal(0);
                    result.task.should.equal(t0);

                    t1.status.should.equal("running");
                    done();
                });
            });
            
            it("should return the task in the hash which failed first", function (done) {
                var t0 = delay(5, "failed");
                var t1 = delay(8, null, "succeeded!");
                
                whenAny({"0": t0, "1": t1}).start().addEventListener("success", function () {
                    var result = this.result;
                    result.key.should.equal("0");
                    result.task.should.equal(t0);
                    
                    t1.status.should.equal("running");
                    done();
                });
            });
        });

        describe("observeError", function () {

            it("should throw error when the task is not started", function () {
                (function () {
                    delay(5, undefined, 10).observeError();
                }).should.throw();                
            });

            it("should throw error when the task is running", function () {
                (function () {
                    delay(5, undefined, 10).start().observeError();
                }).should.throw();
            });

            it("should return the error when it's faulted", function () {
                failure("hello").start().observeError().should.equal("hello");
            });

            it("should return undefined when it's succeeded", function () {
                should.be.nothing(success("hello").start().observeError());
            });
        });
    });

    describe("Binding", function () {
        
        var test = function (timeout, args, callback) {
            if (timeout < 0) {
                callback.apply(this, args);
            } else {
                var _this = this;
                setTimeout(function () {
                    callback.apply(_this, args);
                }, timeout);
            }
        }

        var Binding = Wind.Async.Binding;

        describe("fromCallback", function () {

            it("should return the only result when the callback is called directly", function () {
                var testAsync = Binding.fromCallback(test);
                testAsync(-1, [10]).start().result.should.equal(10);
            });

            it("should return the only result when the callback is called asynchronously", function (done) {
                var testAsync = Binding.fromCallback(test);
                testAsync(1, [10]).start().addEventListener("success", function () {
                    this.result.should.equal(10);
                    done();
                });
            });

            it("should return the first result when the callback is called directly with multiple arguments", function () {
                var testAsync = Binding.fromCallback(test);
                testAsync(-1, [10, 20]).start().result.should.equal(10);
            });

            it("should return the first result when the callback is called asynchronously with multiple arguments", function (done) {
                var testAsync = Binding.fromCallback(test);
                testAsync(1, [10, 20]).start().addEventListener("success", function () {
                    this.result.should.equal(10);
                    done();
                });
            });

            it("should return the correct hash when the callback is called directly with multiple arguments", function () {
                var testAsync = Binding.fromCallback(test, "a", "b");
                testAsync(-1, [10, 20, 30]).start().result.should.eql({ a: 10, b: 20 });
            });

            it("should return the correct hash when the callback is called asynchronously with multiple arguments", function (done) {
                var testAsync = Binding.fromCallback(test, "a", "b");
                testAsync(1, [10, 20, 30]).start().addEventListener("success", function () {
                    this.result.should.eql({ a: 10, b: 20 });
                    done();
                });
            });
        });
        
        describe("fromStandard", function () {

            it("should throw the error when the callback is called with the first argument non-undefined directly", function () {
                var testAsync = Binding.fromStandard(test);
                var error = {};
                var task = testAsync(-1, [error]).start();
                task.status.should.equal("faulted");
                task.error.should.equal(error);
            });

            it("should throw the error when the callback is called with the first argument non-undefined asynchronously", function (done) {
                var testAsync = Binding.fromStandard(test);
                var error = {};
                var task = testAsync(1, [error]).start().addEventListener("failure", function () {
                    this.status.should.equal("faulted");
                    this.error.should.equal(error);
                    done();
                });
            });

            it("should return the only result when the callback is called directly", function () {
                var testAsync = Binding.fromStandard(test);
                testAsync(-1, [undefined, 10]).start().result.should.equal(10);
            });

            it("should return the only result when the callback is called asynchronously", function (done) {
                var testAsync = Binding.fromStandard(test);
                testAsync(1, [undefined, 10]).start().addEventListener("success", function () {
                    this.result.should.equal(10);
                    done();
                });
            });

            it("should return the first result when the callback is called directly with multiple arguments", function () {
                var testAsync = Binding.fromStandard(test);
                testAsync(-1, [undefined, 10, 20]).start().result.should.equal(10);
            });

            it("should return the first result when the callback is called asynchronously with multiple arguments", function (done) {
                var testAsync = Binding.fromStandard(test);
                testAsync(1, [undefined, 10, 20]).start().addEventListener("success", function () {
                    this.result.should.equal(10);
                    done();
                });
            });

            it("should return the correct hash when the callback is called directly with multiple arguments", function () {
                var testAsync = Binding.fromStandard(test, "a", "b");
                testAsync(-1, [undefined, 10, 20, 30]).start().result.should.eql({ a: 10, b: 20 });
            });

            it("should return the correct hash when the callback is called asynchronously with multiple arguments", function (done) {
                var testAsync = Binding.fromStandard(test, "a", "b");
                testAsync(1, [undefined, 10, 20, 30]).start().addEventListener("success", function () {
                    this.result.should.eql({ a: 10, b: 20 });
                    done();
                });
            });

        });
    });
}
