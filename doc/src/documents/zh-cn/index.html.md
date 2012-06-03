---
layout: main-zh-cn
---

<script src="/scripts/jscex-async.bundle.min.js"></script>
<script src="/scripts/sorting-animations.js"></script>

### 新闻

目前已为Jscex设立专项资金。自2012年起，每月1号将为Jscex拨款1024元人民币，用于鼓励个人对Jscex的研究及使用，包括但不限于推广建议，研究，案例，或是在开源项目中使用Jscex。

### 什么是Jscex？

Jscex是JavaScript Computation EXpressions的缩写，它为JavaScript语言提供了一个monadic扩展，能够显著提高一些常见场景下的编程体验（例如异步编程）。Jscex项目完全使用JavaScript编写，能够在任意支持[ECMAScript 3](http://www.ecma-international.org/publications/standards/Ecma-262.htm)的执行引擎里使用，包括各浏览器及服务器端JavaScript环境（例如[Node.js](http://nodejs.org/)）。

Jscex有如下特点：

* 无需学习额外的API或新的语言，直接使用JavaScript语言本身进行编程。
* 功能强大的异步任务模型，支持并行，取消等常用异步编程模式，经过多种技术平台验证。
* 在支持JavaScript语言的环境里直接使用（如浏览器或Node.js），无需额外的编译或转化步骤。
* 基础组件及异步运行库共计4K大小（Minified + GZipped），适合开发网页应用。

### 快速入门

Jscex的核心功能之一，便是对异步编程进行了极大程度的简化，帮助让开发人员摆脱异步编程方面烦恼，将注意力尽可能多地放在逻辑的表现上，而非异步编程过程中的各类奇技淫巧。

请尝试解决以下问题，并与基于Jscex的实现进行比较。

#### 排序算法动画演示

人人都会排序算法，那么能否使用动画来演示排序算法的运作过程？例如以下是快速排序的动画演示：

<input value="排序" type="button" id="btnSort" />

<canvas id="sorting-canvas" width="300" height="300" style="border:solid 1px black">
    您的浏览器不支持Canvas绘图，请使用IE9+，Chrome，Firefox，Safari等现代浏览器。
</canvas>

<script>/* Begin */

    var sa = new SortingAnimations($("#sorting-canvas")[0]);
    var array = sa.randomArray();
    sa.paint(array);
    
    var btnSort = $("#btnSort");
    if (sa.supported) {
        btnSort.click(function () {
            btnSort.attr("disabled", "disabled");
            
            if (array.sorted) {
                array = sa.randomArray();
            }

            sa.quickSortAsync(array).start().addEventListener("success", function () {
                array.sorted = true;
                btnSort.removeAttr("disabled");
            });
        });
    } else {
        btnSort.remove();
    }
    
/* End */</script>

#### 问题分析

我们就以最简单的“冒泡排序”进行分析：

    var compare = function (x, y) {
        return x - y; 
    }

    var swap = function (a, i, j) {
        var t = a[i]; a[i] = a[j]; a[j] = t;
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

所谓冒泡排序，便是使用双重循环，两两比较相邻的元素，如果顺序不对，则交换两者。我们有了基本算法，想要将其用动画表现出来，其实只要运用以下两点策略即可：

* 增加交换和比较操作的耗时，因为排序算法的性能主要取决于交换和比较操作的次数多少。
* 每次交换元素后重绘数组，这样便能表现出排序的动画效果。

看上去很简单，不是吗？

#### 异步编程之殇

在其他一些语言里，我们往往可以使用`sleep`函数让当前线程停止一段时间，这样便起到了“等待”的效果。但是，在JavaScript中我们无法做到这一点，唯一的“延时”操作只能使用setTimeout来实现，但它却需要一个回调函数，我们无法这样让`compare`方法“暂停”一段时间：

    var compare = function (x, y) {
        setTimeout(function () {
            return x - y;
        }, 10); // compare方法依然会立即返回
    }

我们只能把`compare`改造为带有回调函数的方法：

    var compare = function (x, y, callback) {
        setTimeout(function () {
            callback(x - y); // 通过回调函数传递结果
        }, 10);
    }
    
同理，`swap`方法也需要通过回调函数传递结果。此时我们会发现，我们很难在`bubbleSort`中使用异步的`compare`和`swap`方法，而且如果要配合循环和判断一齐使用则更加困难。这就是异步编程在流程控制方面的难点所在：我们无法使用传统的JavaScript进行表达，算法会被回调函数分解地支离破碎。

#### Jscex实现

为了解决异步编程中的流程控制问题，人们设计构造了[各式各样的辅助类库](https://github.com/joyent/node/wiki/modules#wiki-async-flow)来简化开发。但我们认为，流程控制是一个语言层面上的问题，JavaScript已经提供了流程控制需要的所有关键字（例如`if`、`for`、`try`等等），开发人员也早已无数次证明了这种方式的灵活及高效。如果我们可以“修复”这些流程控制机制对异步操作“无效”的问题，则开发人员无需学习新的API，不会引入额外的噪音，一切都是最简单，最熟悉的JavaScript代码。

Jscex便做到了这一点。例如，使用Jscex来实现冒泡排序动画，则只需要：

    var compareAsync = eval(Jscex.compile("async", function (x, y) {
        $await(Jscex.Async.sleep(10)); // 暂停10毫秒
        return x - y; 
    }));

    var swapAsync = eval(Jscex.compile("async", function (a, i, j) {
        $await(Jscex.Async.sleep(20)); // 暂停20毫秒
        var t = a[i]; a[i] = a[j]; a[j] = t;
        paint(a); // 重绘数组
    }));

    var bubbleSortAsync = eval(Jscex.compile("async", function (array) {
        for (var x = 0; x < array.length; x++) {
            for (var y = 0; y < array.length - x; y++) {
                // 异步比较元素
                var r = $await(compareAsync(array[y], array[y + 1]));
                // 异步交换元素
                if (r > 0) $await(swapAsync(array, y, y + 1));
            }
        }
    }));
    
与之前的代码相比，基于Jscex编写的代码只有两个变化：

1. 与传统的`function () { ... }`方式不同，我们使用`eval(Jscex.compile("async", function () { ... }))`来定义一个“异步函数”。这样的函数定义方式是“模板代码”，没有任何变化，可以认做是“异步函数”与“普通函数”的区别。
2. 对于“异步操作”，如上面代码中的`Jscex.Async.sleep`内置函数（其中封装了setTimeout函数），则可以使用`$await(...)`来等待其完成，方法会在该异步操作结束之后才继续下去，其执行流程与普通JavaScript没有任何区别。

完整代码请参考“[排序算法动画](manuals/async/samples/sorting-algorithms.html)”示例，其中实现了“冒泡排序”，“选择排序”以及“快速排序”三种排序算法的动画。

### 总结

JavaScript的异步及非阻塞特性，让程序员无法使用传统方式表达代码，导致语义丢失，算法被分解地支离破碎。例如，由于只能使用setTimeout回调来实现“延迟”效果，即便是要做到“暂停”这样的简单功能，也已经让人难以看出这是一个“冒泡排序”的实现。

Jscex的哲学，是真正将异步编程中的流程控制**回归JavaScript本身**。您可以尝试使用其他任何方式解决这个问题，并与上述基于Jscex的做法进行比较。使用Jscex，让程序员可以在异步的、非阻塞的JavaScript执行环境里使用传统的“阻塞”表达方式编写代码。并让异步任务的协作，取消以及错误处理等常见需求变得前所未有的简单。

更多内容请参考“[Jscex异步模块](./manuals/async/)”。

### 模块

Jscex以模块化形式分发，目前主要有以下几个模块：

* [基础模块](./manuals/main/)
* [JIT编译器模块](./manuals/jit/)
* [AOT编译器模块](./manuals/aot/)
* [构造器基础模块](./manuals/builderbase/)
* [异步模块](./manuals/async/)
 * [异步增强模块](./manuals/async/powerpack.html)

### 错误及反馈

请在[GitHub上汇报错误](https://github.com/JeffreyZhao/jscex/issues)。如果您对Jscex有任何建议或意见，请加入[邮件列表](http://groups.google.com/group/jscex)或直接[与我联系](mailto:jeffz@live.com)。

### 授权

Jscex使用BSD授权协议。

    Copyright 2011 (c) Jeffrey Zhao jeffz@live.com
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
    SUCH DAMAGE.
    
<script>/* Begin */

$("pre > code").last().addClass("no-highlight");

/* End */</script>