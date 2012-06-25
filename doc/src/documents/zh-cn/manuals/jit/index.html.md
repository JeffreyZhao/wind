---
layout: manual-zh-cn
title: JIT编译器模块
---

## <a name="introduction"></a>简介

Jscex的JIT编译器提供了使用Jscex过程中所需的代码变换能力，能将一段带有绑定标志的普通JavaScript方法变为Monad形式，这便是Jscex最为核心的功能。

### <a name="introduction-dependencies"></a>依赖

* 动态依赖：无
* 静态依赖：[解析器模块](../parser/)

## <a name="import-module"></a>引入Jscex编译器模块

首先我们必须[引入核心组件](../core/)，之后再基于这个对象初始化JIT编译器模块。

### <a name="import-module-nodejs"></a>Node.js

如果您使用的是Node.js，可以直接使用[Node Package Manager](http://npmjs.org/)（即npm命令）安装最新的jscex-jit包：

    npm install jscex-jit

然后便可以在脚本中引入该组件：

    var Jscex = require("jscex"); // 引入核心组件
    require("jscex-jit").init(); // 引入并初始化Jscex编译器模块
    
### <a name="import-module-browser"></a>浏览器

在浏览器环境中使用JIT编译器模块，您同样需要引入[核心组件](../core/)。此时在浏览器根（即window对象）上会出现一个Jscex对象，之后再依次引入[解析器](../parser/)及JIT编译器的jscex-jit-x.y.z.js文件即可：

    <!-- 核心组件 -->
    <script src="jscex-x.y.z.js"></script>

    <!-- 解析器模块 -->
    <script src="jscex-parser-x.y.z.js"></script>
    <!-- JIT编译器模块 -->
    <script src="jscex-jit-x.y.z.js"></script>
    
至此，Jscex根对象已经包括了使用JIT编译器所需的所有成员。这种方式也适合各类**没有**实现CommonJS等包加载规范的JavaScript运行环境。

### <a name="import-module-others"></a>其他环境

Jscex自动支持一些其他的包加载规范。假如当前JavaScript运行环境实现了这些规范，则Jscex会自动采用这些规范。详细信息请参考“[包引入](../importing.html)”相关内容。