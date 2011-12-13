## 新闻

目前已为Jscex设立专项资金。自2012年起，每月1号将为Jscex拨款1024元人民币，用于鼓励个人对Jscex的研究及使用，包括但不限于推广建议，研究，案例，或是在开源项目中使用Jscex。

此外，如果您在今年最后一个月内提出切实有效的推广建议或是案例，将有机会获得**Windows Phone手机一部**！

## 什么是Jscex？

Jscex是JavaScript Computation EXpressions的缩写，它为JavaScript语言提供了一个monadic扩展，能够显著提高一些常见场景下的编程体验（例如异步编程）。Jscex项目完全使用JavaScript编写，能够在任意支持[ECMAScript 3](http://www.ecma-international.org/publications/standards/Ecma-262.htm)的执行引擎里使用，包括各浏览器及服务器端JavaScript环境（例如[Node.js](http://nodejs.org/)）。

## 快速入门

Jscex的核心功能之一，便是对异步编程进行了极大程度的简化，帮助让开发人员摆脱异步编程方面烦恼，将注意力尽可能多地放在逻辑的表现上，而非异步编程过程中的各类奇技淫巧。

请尝试解决以下问题，并与基于Jscex的实现进行比较。

### 问题：每隔一秒打印菲波那契数列

您一定听说过[菲波那契（Fibonacci）数列](http://en.wikipedia.org/wiki/Fibonacci_number)，它的定义是：

![image](http://latex.codecogs.com/gif.latex?F_n%20=%20F_{n-1}%20+%20F_{n%20-%202})

其边界情况为：

![image](http://latex.codecogs.com/gif.latex?F_0%20=%200,%20F_1%20=%201)

我们可以很轻松地写出其迭代算法：

    var fib = function () {                console.log(0);        console.log(1);        var a = 0, current = 1;        while (true) {            var b = a;            a = current;            current = a + b;            console.log(current);        }    };

执行`fib()`会无限打印出菲薄纳契数列中的每一项。那么，您能将其改写成“每隔一秒打印一项”吗？

### 引入Jscex脚本

Jscex可以在任何JavaScript引擎上执行，我们这里目前最典型的两类JavaScript执行环境来演示Jscex使用方式。

#### 浏览器

请下载[src目录](src)下的所有文件，并在相同目录下创建quick-start.html文件，写入：

    <script src="uglifyjs-parser.js"></script>
    <script src="jscex-jit.js"></script>
    <script src="jscex-builderbase.js"></script>
    <script src="jscex-async.js"></script>
    <script src="jscex-async-powerpack.js"></script>

Jscex模块化十分细致，但您暂时无需了解以上脚本的含义。

#### Node.js

Node.js是目前流行的网络开发技术。如果要在Node.js中使用Jscex，可以使用[Node Package Manager](http://npmjs.org/)（即npm命令）安装jscex-jit及jscex-async两个模块。

    npm install jscex-jit jscex-async

您暂时还需要下载jscex-async-powerpack.js文件，并在其相同目录下创建quick-start.js，写入：

    var Jscex = require("jscex-jit");
    require("jscex-async").init(Jscex);
    require("./jscex-async-powerpack").init(Jscex);

### 实现

基于Jscex实现“每隔一秒打印菲薄纳契数列”十分简单直接，请在quick-start.html或quick-start.js里写入以下脚本：

    var fib = eval(Jscex.compile("async", function () {        $await(Jscex.Async.sleep(1000)); // “暂停”一秒        console.log(0);                $await(Jscex.Async.sleep(1000)); // “暂停”一秒        console.log(1);        var a = 0, current = 1;        while (true) {            var b = a;            a = current;            current = a + b;            $await(Jscex.Async.sleep(1000)); // “暂停”一秒            console.log(current);        }    }));

    fib().start();

### 执行

请使用Chrome，Firefox，Safari或IE8及以上版本浏览器打开quick-start.html页面（Jscex支持IE 6及以上浏览器，但当前示例并不支持，详细信息请参考“[Jscex JIT编译器使用指南](doc/jit-cn.md)”），或使用Node.js执行quick-start.js文件：

    node quick-start.js

此时，您将会在浏览器工具或是Node.js标准输出里看到菲薄纳契数列，每隔一秒输出一项。

您也可以在[示例目录](samples/async)下找到[quick-start.html](samples/async/quick-start.html)及[quick-start.js](samples/async/quick-start.js)文件。

### 其他

您可以尝试使用其他任何方式解决这个问题，并与基于Jscex的做法进行比较。

JavaScript的异步及非阻塞特性，让程序员无法使用传统方式表达代码，导致语义丢失，算法被分解地支离破碎。例如，由于只能使用setTimeout回调来实现“延迟”效果，即便是要做到“每隔一秒”这样的简单功能，也已经让人难以看出这是一个“菲薄纳契”数列的实现。

使用Jscex，让程序员可以在异步的、非阻塞的JavaScript执行环境里使用传统的“阻塞”表达方式编写代码。并让异步任务的协作，取消以及错误处理等常见需求变得前所未有的简单。

更多内容请参考[Jscex异步模块](doc/async/README-cn.md)。

## 模块

Jscex以模块化形式分发，目前有以下几个模块：

* [JIT编译器](doc/jit-cn.md)
* [构造器基础模块](doc/builderbase-cn.md)
* [异步模块](doc/async/README-cn.md)
* [异步增强模块](doc/async/powerpack-cn.md)

## 错误及反馈

请在[GitHub上汇报错误](https://github.com/JeffreyZhao/jscex/issues)。如果您对Jscex有任何建议或意见，请加入[邮件列表](http://groups.google.com/group/jscex)或直接[与我联系](mailto:jeffz@live.com)。

## 授权

Jscex使用BSD授权协议。

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
