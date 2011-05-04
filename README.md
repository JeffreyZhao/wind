"Jscex" is short for "JavaScript Computation EXpressions". It provides a monadic extensions for JavaScript language and would significantly improve your programming life in certain scenarios. The project is written in JavaScript completely, which mean it can be used in any execution engines support [ECMAScript 3](http://www.ecma-international.org/publications/standards/Ecma-262.htm), including mainstream browsers or server side JavaScript environments (e.g., [Node.js](http://nodejs.org/)).

Currently features:

* A JIT (just-in-time) compiler which generates codes **at runtime**, mainly used in development environment.
* An AOT (ahead-of-time) compiler which generates code **before runtime**. The AOT compiled code are independent of JIT compiler, which is target in production environment.
* An async library which simplified async programming significantly.

# Jscex asynchronous library

Asynchronous programming is essential, especially in JavaScript. JavaScript doesn't provide any primitives for writing codes can block the execution. Any operations which take a period of time have to be written in async ways. Async operations usually send back the results by callback functions when finished, and we could do the rest of work in the callback.

Here comes the problem. We usually express our work linearly, but async tasks with callbacks require logical division of algorithms. We cannot write conditions with <code>if</code> or loops with <code>while</code>/<code>for</code>/<code>do</code> statements. It's also very difficult to combine multiple asynchronous operations or handle exceptions and cancellation.

So Jscex comes to the rescue with its asynchronous library.

## How to use

The core feature of Jscex is a compiler which convert standard JavaScript functions into a monadic ones. The compiler consists of three parts:

* lib/json2.js: The [JSON](http://json.org/) stringifier provided by Douglas Crockfod. You need this file for the environment doesn't suuport <code>JSON.stringify</code> method.
* lib/uglifyjs-parser.js: The JavaScript parser of [UglifyJS](https://github.com/mishoo/UglifyJS) project. It's the JavaScript port of the LISP project [parse-js](http://marijn.haverbeke.nl/parse-js/).
* src/jscex.js: The implementation of Jscex JIT compiler, which produces code at runtime.

All the three files list above are uncompressed version mainly used for developement. The minified version of them are in "bin" folder, which is suitable for production use (if you're not using AOT compile mode, see the "AOT compiler" section for more detail). Furthermore, the dev version of Jscex compiler would produce programmer-friendly code, which is easily for debugging and the minified version would run a little faster.

To use the async library of Jscex, we should also load the "src/jscex.async.js" file. Now everything is prepared, here's how we compile a normal JavaScript function with async builder:

    var somethingAsync = eval(Jscex.compile("async", function (a, b) {
        // implementation
    }));

Please visit the following sections for more details.

## Samples:

All the following samples can be found in samples/async folder.

### Clock:

We are going to draw a clock with HTML5 canvas on the page ([samples/async/clock.html](http://files.zhaojie.me/demos/jscex/samples/async/clock.html)). It's rather easy for most front-end programmers:

    function drawClock(time) {
        // clear and canvas and draw a clock on it.
    }

    setInterval(1000, function () {
        drawClock(new Date());
    });

That's the implementation with callback, but in Jscex we could write code like this:

    var drawClockAsync = eval(Jscex.compile("async", function (interval) {
        while (true) {
            drawClock(new Date());
            // wait for an async operation to complete
            $await(Jscex.Async.sleep(interval));
        }
    }));

    drawClockAsync(1000).start();

We wrote an infinite loop in the async method <code>drawClockAsync</code>, in each iteration we draw a clock with current time and call <code>Jscex.Async.sleep</code> method, the sleep operation **blocks** the code for 1 seconds.

How can we block the code without the support of runtime? The magic here is: we are not actually executing the code we wrote, the <code>Jscex.compile</code> method accept the function we provide and convert it into another (it's not necessory for us to understand the code currently):

    (function (interval) {
        var $$_builder_$$_0 = Jscex.builders["async"];
        return $$_builder_$$_0.Start(this,
            $$_builder_$$_0.Loop(
                function () {
                    return true;
                },
                null,
                $$_builder_$$_0.Delay(function () {
                    drawClock(new Date());
                    return $$_builder_$$_0.Bind(Jscex.Async.sleep(interval), function () {
                        return $$_builder_$$_0.Normal();
                    });
                }),
                false
            )
        );
    })

The string form of the new function generated by Jscex compiler will be dynamicly executed by <code>eval</code> method, preserving the current scope and context (variables, closures, etc.).

The <code>$await</code> method is the "bind" operation of <code>async</code> builder, it tells the compiler to put the code after that in the callback for the builder's "Bind" method. The <code>$await</code> method accepts an async task generated by <code>Jscex.Async.sleep</code>, provides a semantic of "waiting the operation to complete". The <code>Bind</code> method also start the task if it's not running.

It seems the implementation with Jscex is a bit longer in this simple case - please look at the following samples. They will tell you the real power of Jscex.

### Animations

Animations are important for rich user interfaces. Let's build an animation like "move the element from here to there in a period of time" ([samples/async/move.html](http://files.zhaojie.me/demos/jscex/samples/async/move.html)). The traditional version of the <code>move</code> could be:

    var moveTraditionally = function (e, startPos, endPos, duration, callback) {

        var t = 0;

        // move a bit
        function move() {
            e.style.left = startPos.x + (endPos.x - startPos.x) * t / duration;
            e.style.top = startPos.y + (endPos.y - startPos.y) * t / duration;

            t += 50;
            if (t < duration) {
                setTimeout(50, move);
            } else { // finished
                e.style.left = endPos.x;
                e.style.top = endPos.y;
                callback();
            }
        }

        setTimeout(50, move);
    }

Can someone tell me the algorithm used to move the element? Maybe we would understand the implementation after reading the code again and again, but it's really difficult and uncomfortable for the programmer to read and write codes like that. But everything would be changed with Jscex:

    var moveAsync = eval(Jscex.compile("async", function (e, startPos, endPos, duration) {
        for (var t = 0; t < duration; t += 50) {
            e.style.left = startPos.x + (endPos.x - startPos.x) * t / duration;
            e.style.top = startPos.y + (endPos.y - startPos.y) * t / duration;
            $await(Jscex.Async.sleep(50));
        }

        e.style.left = endPos.x;
        e.style.top = endPos.y;
    }));

We could express our algorithm in normal way (linearly): loop with a <code>for</code> statement, sleep for 50 milliseconds in each iteration and move the element again. It's just simple and elegant.

Now we got an async method <code>moveAsync</code>, we can use it when building another async method, just like the <code>Jscex.Async.sleep</code> method in the core library. They both return the async tasks implementing the same protocal for outside. So check out the method below:

    var moveSquareAsync = eval(Jscex.compile("async", function(e) {
        $await(moveAsync(e, {x:100, y:100}, {x:400, y:100}, 1000));
        $await(moveAsync(e, {x:400, y:100}, {x:400, y:400}, 1000));
        $await(moveAsync(e, {x:400, y:400}, {x:100, y:400}, 1000));
        $await(moveAsync(e, {x:100, y:400}, {x:100, y:100}, 1000));
    }));

We can easily find out how <code>moveSquareAsync</code> method works: it moves an element with a square routine. It's really easy to combine multiple async operations into another in Jscex.

### Sorting animations:

Every programmer learns sorting algorithms, like bubble sort:

    var compare = function (x, y) {
        return x - y; 
    }

    var swap = function (array, i, j) {
        var t = array[x];
        array[x] = array[y];
        array[y] = t;
    }

    var bubbleSort = function (array) {
        for (var x = 0; x < array.length; x++) {
            for (var y = 0; y < array.length - x; y++) {
                if (compare(array[y], array[y + 1]) > 0) {
                    swap(array, y, y + 1);
                }
            }
        }
    }

The basic idea of represent an sorting algorithm with animations is simple: repaint the graph after each swap and wait for a little time. But the implementation is not as easy as the idea looks like, we cannot use <code>for</code> loops anymore if we "stop" the code execution for some time using <code>setTimeout</code>. But let's check out the Jscex version:

    var compareAsync = eval(Jscex.compile("async", function (x, y) {
        $await(Jscex.Async.sleep(10)); // each "compare" takes 10 ms.
        return x - y;
    }));

    var swapAsync = eval(Jscex.compile("async", function (array, x, y) {
        var t = array[x];
        array[x] = array[y];
        array[y] = t;

        repaint(array); // repaint after each swap

        $await(Jscex.Async.sleep(20)); // each "swap" takes 20 ms.
    }));

    var bubbleSortAsync = eval(Jscex.compile("async", function (array) {
        for (var x = 0; x < array.length; x++) {
            for (var y = 0; y < array.length - x; y++) {
                var r = $await(compareAsync(array[y], array[y + 1]));
                if(r > 0) {
                    $await(swapAsync(array, y, y + 1));
                }
            }
        }
    }));

I believe there's no need to explain more - it's just the standard "bubble sort" algorithm. And of course we can create animation for "quick sort":

    var _partitionAsync = eval(Jscex.compile("async", function (array, begin, end) {
        var i = begin;
        var j = end;
        var pivot = array[Math.floor((begin + end) / 2)];

        while (i <= j) {
            while (true) {
                var r = $await(compareAsync(array[i], pivot));
                if (r < 0) { i++; } else { break; }
            }

            while (true) {
                var r = $await(compareAsync(array[j], pivot));
                if (r > 0) { j--; } else { break; }
            }

            if (i <= j) {
                $await(swapAsync(array, i, j));
                i++;
                j--;
            }
        }

        return i;
    }));
    
    var _quickSortAsync = eval(Jscex.compile("async", function (array, begin, end) {
        var index = $await(_partitionAsync(array, begin, end));

        if (begin < index - 1) {
            $await(_quickSortAsync(array, begin, index - 1));
        }

        if (index < end) {
            $await(_quickSortAsync(array, index, end));
        }
    }));

    var quickSortAsync = eval(Jscex.compile("async", function (array) {
        $await(_quickSortAsync(array, 0, array.length - 1));
    }));

The complete sample is in "[samples/async/sorting-animations.html](http://files.zhaojie.me/demos/jscex/samples/async/sorting-animations.html)". After opening the page with browser support HTML5 canvas, you can click the links to view the animation of three sorting algorithms: [bubble sort](http://files.zhaojie.me/demos/jscex/samples/async/sorting-animations.html?quick), [selection sort](http://files.zhaojie.me/demos/jscex/samples/async/sorting-animations.html?selection) and [quick sort](http://files.zhaojie.me/demos/jscex/samples/async/sorting-animations.html?quick).

### Tower of Hanoi

[Tower of Hanoi](http://en.wikipedia.org/wiki/Tower_of_Hanoi) is a puzzle of moving discs. It has a simple, recursive solution:

1. move n−1 discs from A to B (with the help of C). This leaves disc n alone on peg A
2. move disc n from A to C
3. move n−1 discs from B to C (which the help of A) so they sit on disc n

which in code:

    var hanoi = function (n, from, to, mid) {
        if (n > 0) hanoi(n - 1, from, mid, to);
        moveDisc(n, from, to);
        if (n > 0) hanoi(n - 1, mid, to from);
    }

    hanoi(5, "A", "C", "B");

If we need to show the algorithm in animation ([samples/async/hanoi.html](http://files.zhaojie.me/demos/jscex/samples/async/hanoi.html)), we could re-write the code just like the sample above:

    var hanoiAsync = eval(Jscex.compile("async", function(n, from, to, mid) {
        if (n > 0) {
            $await(hanoiAsync(n - 1, from, mid, to));
        }
        
        $await(moveDiscAsync(n, from, to));

        if (n > 0) {
            $await(hanoiAsync(n - 1, mid, to, from));
        }
    }));

    hanoiAsync(5, "A", "C", "B").start();

If you open the sample page in the browser, you'll find the discs is moving one by one, resolving the puzzle automatically. Maybe it's not quite easy for someone to follow each step, so let's just make a little change:

    var hanoiAsync = eval(Jscex.compile("async", function(n, from, to, mid) {
        if (n > 0) {
            $await(hanoiAsync(n - 1, from, mid, to));
        }

        // wait for the button's being clicked
        var btnNext = document.getElementById("btnNext");
        $await(Jscex.Async.onEvent(btnNext, "click"));

        $await(moveDiscAsync(n, from, to));

        if (n > 0) {
            $await(hanoiAsync(n - 1, mid, to, from));
        }
    }));

Before each <code>moveDiscAsync</code> operation, the program would wait for the button's "click" event. In Jscex async library, "async task" only means "operation would be finished in the future". In the example above, the button's "click" event is also an async task - the task would be finished [when the button is clicked](http://files.zhaojie.me/demos/jscex/samples/async/hanoi-2.html), then the program keeps going, move a disc and wait for another click.

People can write async programs without callbacks, that's how Jscex improve productivity and maintainability.

### Simple web-server with Node.js

Jscex works for any execution engines support ECMAScript 3, not only browsers but also server-side environment like Node.js. Node.js is a server-side JavaScript environment that uses an asynchronous event-driven model. This allows Node.js to get excellent performance based on the architectures of many internet applications.

Here's a simple file server build with Node.js:

    var http = require("http");
    var fs = require("fs");
    var url = require("url");
    var path = require("path");

    var transferFile = function(request, response) {
        var uri = url.parse(request.url).pathname;
        var filepath = path.join(process.cwd(), uri);

        // check whether the file is exist and get the result from callback
        path.exists(filepath, function(exists) {
            if (!exists) {
                response.writeHead(404, {"Content-Type": "text/plain"});
                response.write("404 Not Found\n");
                response.end();
            } else {
                // read the file content and get the result from callback
                fs.readFile(filepath, "binary", function(error, data) {
                    if (error) {
                        response.writeHead(500, {"Content-Type": "text/plain"});
                        response.write(error + "\n");
                    } else {
                        response.writeHead(200);
                        response.write(data, "binary");
                    }

                    response.end();
                });
            }
        });
    }

    http.createServer(function(request, response) {
        transferFile(request, response);
    }).listen(8124, "127.0.0.1");

There're two async method used above: <code>path.exists</code> and <code>fs.readFile</code>. Most I/O api in Node.js are asynchronous, which brings great scalability but low programmability. But with the help of Jscex, we can write async programs as easy as normal code (samples/async/node-server.js):

    require("../../lib/uglifyjs-parser.js");
    require("../../src/jscex.js");
    require("../../src/jscex.async.js");
    require("../../src/jscex.async.node.js");

    Jscex.Async.Node.Path.extend(path);
    Jscex.Async.Node.FileSystem.extend(fs);

    var transferFileAsync = eval(Jscex.compile("async", function(request, response) {
        var uri = url.parse(request.url).pathname;
        var filepath = path.join(process.cwd(), uri);

        var exists = $await(path.existsAsync(filepath));
        if (!exists) {
            response.writeHead(404, {"Content-Type": "text/plain"});
            response.write("404 Not Found\n");
        } else {
            var file = $await(fs.readFileAsync(filepath));
            if (file.error) {
                response.writeHead(500, {"Content-Type": "text/plain"});
                response.write(file.error + "\n");
            } else {
                response.writeHead(200);
                response.write(file.data, "binary");
            }
        }

        response.end();
    }));

    http.createServer(function(request, response) {
        transferFileAsync(request, response).start();
    }).listen(8125, "127.0.0.1");

All the Jscex files are compatible with [CommonJS](http://commonjs.org/) module specification, which can be loaded by <code>require</code> method in Node.js. Jscex async library has a simple model of "async tasks", everyone can easily write extensions/adaptors for existing async operations. Please check the following section for more details.

## Async tasks and extensions for async operations

Jscex async library works with async tasks. An async task uses protocal defined in <code>Jscex.Async.Task</code>, which followed by Jscex functions and the build in helpers like <code>Jscex.Async.sleep</code>. An task object has the following members:

* <code>start()</code> method: start an async task. This method can only be invoked in "ready" status.
* <code>addListener(onComplete)</code> method: register an "onComplete" handler which would be called when the task is completed (either succeeded or failed). We can register handlers in "ready" and "running" status. A handler would be passed the task object as the only argument.
* <code>status</code> field: indicated the status of the task. There're four kinds of status:
  * ready: when the task is created but not started.
  * running: the <code>start</code> method is called and the task is running.
  * succeeded: the task is succeeded and we can get the result from the <code>result</code> field.
  * failed: the task is failed and we can get the error from the <code>error</code> field.
* <code>result</code> field: get the result of the task, see the <code>status</code> "succeeded" above.
* <code>error</code> field: get the error of the task, see the <code>status</code> "failed" above.

Here's the sample of using async tasks manually:

    var someMethodAsync = eval(Jscex.compile("async", function () {
        // ...
    }));

    var task = someMethodAsync();
    task.addListener(function (t) {
        if (t.status == "succeeded") {
            console.log(t.result);
        } else if (t.status == "failed") {
            console.log(t.error);
        } else {
            throw "Something got wrong in Jscex async library.";
        }
    });

    task.start();

The <code>$await</code> operator in Jscex function would also handle an async task with these members.

### Write extensions/adaptors for async operations.

There're plenty of async operations already exists, maybe in the browser (e.g. DOM events) or in the other library/frameworks (jQuery animations, Node.js APIs). Everyone can easily write extensions/adaptors for existing async operations. For example, we can extend the XMLHttpRequest object to simplify the usage (src/jscex.async.xhr.js):

    XMLHttpRequest.prototype.receiveAsync = function () {
        var _this = this;

        var delegate = {
            "start": function (callback) {
                _this.onreadystatechange = function () {
                    if (_this.readyState == 4) {
                        callback("success", _this.responseText);
                    }
                }

                _this.send();
            }
        };

        return new Jscex.Async.Task(delegate);
    }

The <code>Jscex.Async.Task</code> class accept an delegate of the async operation. The delegate object has a <code>start</code> method which accept a callback function. Invoke the callback when the async operation completes:

* <code>callback("success", result)</code> when the operation finished normally:
* <code>callback("failure", error)</code> when error occurred.

As another example, The Node.js sample above uses the extensions defined in "src/jscex.async.node.js":

    Jscex.Async.Node = {};
    Jscex.Async.Node.Path = {};
    Jscex.Async.Node.FileSystem = {};

    Jscex.Async.Node.Path.extend = function (path) {

        path.existsAsync = function (filepath) {
            var delegate = {
                "start": function (callback) {
                    path.exists(filepath, function (exists) {
                        callback("success", exists);
                    });
                }
            };

            return new Jscex.Async.Task(delegate);
        };
    }

    Jscex.Async.Node.FileSystem.extend = function (fs) {

        fs.readFileAsync = function (filepath) {
            var delegate = {
                "start": function (callback) {
                    fs.readFile(filepath, function (error, data) {
                        var result = { error: error, data: data };
                        callback("success", result);
                    });
                }
            };

            return new Jscex.Async.Task(delegate);
        }
    }

Jscex would provide more build in extensions for popular JavaScript libraries/frameworks in the future.

## Limitations:

There're three limitations of the current version of Jscex - none of them becomes a real problem in my experiences.

### Need separate $await statement

Jscex compiler can only handle explicit <code>$await</code> operation:

* Simple: <code>$await(...);</code>
* Assign the result to a variable: <code>var r = $await(...);</code>
* Directly return: <code>return $await(...);</code>

Other kinds of usages could not be compiled:

    f(g(1), $await(...))

    if (x > y && $await(...)) { ... }

We should put <code>$await</code> in separate statement:

    var a1 = g(1);
    var a2 = $await(...);
    f(a1, a2);

    if (x > y) {
        var flag = $await(...);
        if (flag) { ... }
    }

### Nested Jscex functions

If you write nested Jscex functions, the inner function can also be compiled with outside one. For example:

    var outerAsync = eval(Jscex.compile("async", function () {

        var innerAsync = eval(Jscex.compile("async", function () {
            // inner implementations
        }));

    }));

At runtime, <code>outerAsync</code> would be compiled to:

    (function () {
        var $$_builder_$$_0 = Jscex.builders["async"];
        return $$_builder_$$_0.Start(this,
            $$_builder_$$_0.Delay(function () {

                var innerAsync = (function () {
                    var $$_builder_$$_1 = Jscex.builders["async"];
                    return $$_builder_$$_1.Start(this,
                        // compiled inner implementations
                        $$_builder_$$_1.Normal()
                    );
                });

                return $$_builder_$$_0.Normal();
            })
        );
    })

But the compilation (of inner function) is based on static code parsing and generation, so the compiler can only recognize the "standard pattern": <code>eval(Jscex.compile("builderName", function () { ... }))</code>. Please see the section "AOT Compiler - Limitation" for more details.

### Language support:

Jscex compiler could generate code for almost all the features of ECMAScript 3 except:

* Break to label
* Bind operation (e.g. <code>$await</code>) in <code>switch</code> statement, please use <code>if</code>/<code>else</code> instead.

# AOT compiler

The AOT (ahead-of-time) compiler is a piece of JavaScript code (scripts/jscexc.js) which generates code before runtime.

## Why we need an AOT compiler.

The JIT compiler works just fine. The function would be compiled only once for each page load or node.js execution, so the performance cost of compiler is really small. And the size of compiler is only around 10K when minified and gzipped - acceptable for me.

But the problem comes with "script compressing". Normally, the script used for websites would be compressed by tools like UglifyJS, Closure Compiler or YUI compressor. Jscex compiler works fine when the compress strategy is just removing the whitespaces and shortening the name of variables, but modern compressors would rewrite the statement structures for getting minimal size:

    var bubbleSortAsync=eval(Jscex.compile("async",function(a){for(var b=0;b<a.length;b++)for(var c=0;c<a.length-b;c++){var d=$await(compareAsync(a[c],a[c+1]));d>0&&$await(swapAsync(a,c,c+1))}}))

The code above is the code of bubble sort animation compressed by UglifyJS. Please notice that Jscex cannot handle code like <code>d>0&&$await(...)</code>, so we have to compile the code before compressing. That the main reason I build an AOT compiler.

## Usage

The AOT compiler runs with node.js:

    node scripts/jscexc.js --input input_file --output output_file

For the <code>bubbleSortAsync</code> method above, it would be compiled into:

    (function (array) {
        var $$_builder_$$_0 = Jscex.builders["async"];
        return $$_builder_$$_0.Start(this,
            $$_builder_$$_0.Delay(function () {
                var x = 0;
                return $$_builder_$$_0.Loop(
                    function () {
                        return x < array.length;
                    },
                    function () {
                        x++;
                    },
                    $$_builder_$$_0.Delay(function () {
                        var y = 0;
                        return $$_builder_$$_0.Loop(
                            function () {
                                return y < (array.length - x);
                            },
                            function () {
                                y++;
                            },
                            $$_builder_$$_0.Delay(function () {
                                return $$_builder_$$_0.Bind(compareAsync(array[y], array[y + 1]), function (r) {
                                    if (r > 0) {
                                        return $$_builder_$$_0.Bind(swapAsync(array, y, y + 1), function () {
                                            return $$_builder_$$_0.Normal();
                                        });
                                    } else {
                                        return $$_builder_$$_0.Normal();
                                    }
                                });
                            }),
                            false
                        );
                    }),
                    false
                );
            })
        );
    })

The AOT compiler would keep the code others than Jscex functions. The code generated by AOT compiler could be compressed safely. Futhermore, the compiled code could execute without "json2.js", "uglifyjs-parser.js" and "jscex.js". The async methods could be executed properly with only "jscex.async.js", which is only 3KB when gzipped. Besides, the AOT compiled code can now be executed in the future "strict mode" of ECMAScript 5 (which doesn't support <code>eval</code> method).

## Limitation

The AOT compiler would parse the input scripts **statically** and generate new code, so it can only recognize the standard pattern: <code>eval(Jscex.compile("builderName", function () { ... }))</code>. The follow codes work fine with JIT compiler but cannot be compiled by AOT compiler.

    var compile = Jscex.compile;
    var builderName = "async";
    var func = function () { ... };
    var newCode = compile(builderName, func);
    var funcAsync = eval(newCode);

Luckily, the standard pattern is quite enough in my experiences, so this limitation won't be an issue in real world.

# Beyond async

Jscex is not only for async programming. The Jscex compiler turns the input function into a standard monadic form, the rest work are done by "Jscex builder". Jscex releases with a build-in "async builder" could simplify async programming, we can also define a "seq builder" to help constructing "iterators" in JavaScript (ECMAScript 3) - like the ["generator" feature in JavaScript 1.7](https://developer.mozilla.org/en/JavaScript/Guide/Iterators_and_Generators) or Python/C#, etc.

    var rangeSeq = eval(Jscex.compile("seq", function (minInclusive, maxExclusive) {
        for (var i = minInclusive; i < maxExclusive; i++) {
            $yield(i);
        }
    }));

Jscex builders register themselves in <code>Jscex.builders</code> dictionary. The builder would be retrieved by name at runtime, you can get the following code by watching the <code>console.log</code> output or use the AOT compiler:

    (function (minInclusive, maxExclusive) {
        var $$_builder_$$_0 = Jscex.builders["seq"];
        return $$_builder_$$_0.Start(this,
            $$_builder_$$_0.Delay(function () {
                var i = minInclusive;
                return $$_builder_$$_0.Loop(
                    function () {
                        return i < maxExclusive;
                    },
                    function () {
                        i++;
                    },
                    $$_builder_$$_0.Delay(function () {
                        return $$_builder_$$_0.Bind(i, function () {
                            return $$_builder_$$_0.Normal();
                        });
                    }),
                    false
                );
            })
        );
    })

Unfortunately, the "seq builder" is not part of Jscex at this moment. It's one of the future plans of Jscex project.

# Comparison to other projects

There're several other projects has the same purpose. We can put these project into two categories.

## Library extensions:

Most projects build libraries to [simplify async programming in JavaScript](http://www.infoq.com/articles/surviving-asynchronous-programming-in-javascript):

    // async.js (https://github.com/fjakobs/async.js)
    async.list([
        asncFunction1,
        asncFunction2,
        asncFunction3,
        asncFunction4,
        asncFunction5,
    ]).call().end(function(err, result) {
        // do something useful
    });

    // Step (https://github.com/creationix/step)
    Step(
        function readSelf() {
            fs.readFile(__filename, this);
        },
        function capitalize(err, text) {
            if (err) throw err;
            return text.toUpperCase();
        },
        function showIt(err, newText) {
            if (err) throw err;
            console.log(newText);
        }
    );

People use these solutions need to follow the programming patterns defined by the library, but Jscex just follows JavaScript idioms, programming with Jscex is just programming in JavaScript. So Jscex has a really gentle learning curve.

## Language extensions:

A few projects are "Language extensions" - for these projects like [StratifiedJS](http://www.infoq.com/articles/stratifiedjs) and [Narrative JavaScript](http://www.neilmix.com/narrativejs/doc/), people write "JavaScript-like" codes and compile them to "real JavaScripts":

    // Narrative JavaScript code
    function sleep(millis) {
        var notifier = new EventNotifier();
        setTimeout(notifier, millis);
        notifier.wait->();
    }

    // StratifiedJS code
    var result;
    waitfor {
      result = performGoogleQuery(query);
    }
    or {
      result = performYahooQuery(query);
    }    

Although these languages could be quite similar to JavaScript, but they're really not, especially the syntax and semantic related to async programming. Programmers have to learn "new languages" when using them. And these new languages may also break the JavaScript editors. Jscex is nothing more than JavaScript and even the <code>$await</code> operations are simple method calls - the only semantic related to that is "wait until finished", everyone knows how to programming in Jscex in minutes.

And in traditional JavaScript programming, people modify the code and refresh the page to see whether things got right. But these "new languages" cannot being executed in browsers (or other ECMASCript 3 engines) directly, it should be compiled into JavaScript before runtime. Project like Narrative and StratifiedJS also provide JIT compiler which load and produce code as runtime. But the way they use have obvious limitations:

If the sources are loaded by XMLHttpRequest, these source files have to be host in the same domain with website. JSONP can be used to load sources from other domains, but it's not loading remote sources directly, it loads the content in "method call" style - the source files have to be processed before sending to the client.

These project may also load <code>script</code> blocks written inside the page. The compiler would load these code snippets from the DOM and compile them when page loaded. But in the case like:

    <!-- codes to compile -->
    <script type="some-special-type">
        // define an async method
    </script>

    <script type="text/javascript">
        // cannot use the async method here
    </script>

People cannot use the async methods defined in previous. It's not the behavior people are currently using in JavaScript programming.

But Jscex is nothing more than JavaScript:

* There's no clear separation between compile-time and runtime, code are compiled by the JIT compiler at runtime when develop.
* Jscex codes are standard JavaScript, people can use normal JavaScript editors to write and format Jscex functions.
* Jscex source files are JavaScript source files. They can be hosted in different domains and used in webpage as normal extenal scripts files.
* Jscex functions defined in browser's <code>script</code> browser can be used by the code next to it immediately.

Jscex just keeps nearly everything as usual for JavaScript programmers.

# Jscex internals

(more details in the future)

# Futures

* Better async builder
  * Better performance
  * Support "cancellation" for async tasks
  * More primitives in <code>Jscex.Async</code>
* Support "seq builder"
* Extensions for popular JavaScript libraries/frameworks (jQuery, Node.js, etc.)

# Related projects

* F#: the whole Jscex project are inspired by F#'s genis features "[Computation Expressions](http://msdn.microsoft.com/en-us/library/dd233182.aspx)" and "[Asynchronous Workflow](http://msdn.microsoft.com/en-us/library/dd233250.aspx)".
* C# vNext: the future version of C# provide great async programming support just like F# Async Workflow and Jscex. the name "$await" is borrowed from the "await" keyword in C# vNext.
* UglifyJS: the Jscex compiler use the parser of UglifyJS. It's simple, fast and works fine in ECMAScript 3 engines.
* [Narcissus](https://github.com/mozilla/narcissus/): Narcissus is a JavaScript interpreter written in JavaScript, using the [SpiderMonkey](http://www.mozilla.org/js/spidermonkey/) engine. Its parser is much slower than UglifyJS's and dependent on SpiderMonkey extensions. But it produces an AST carries more information which is really helpful for AOT compiler.
* [Closure Compiler](http://code.google.com/closure/compiler/): used to compress scripts.

# Bugs or Feedbacks?

Feel free to contact me for any bugs or feedbacks, please [use the Google Groups](http://groups.google.com/group/jscex) or email me directly.

# License

Jscex is released under the BSD license:

<pre>Copyright 2011 (c) Jeffrey Zhao &lt;jeffz@live.com&gt;
Based on UglifyJS (https://github.com/mishoo/UglifyJS).

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:

    * Redistributions of source code must retain the above
      copyright notice, this list of conditions and the following
      disclaimer.

    * Redistributions in binary form must reproduce the above
      copyright notice, this list of conditions and the following
      disclaimer in the documentation and/or other materials
      provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
SUCH DAMAGE.</pre>
