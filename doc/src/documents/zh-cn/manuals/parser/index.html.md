---
layout: manual-zh-cn
title: 解析器模块
---

## <a name="introduction"></a>简介

Jscex解析器模块提供了Jscex编译器（如[JIT编译器](../jit/)和[预编译器](../aot/)）所需要的JavaScript语法解析功能，目前使用的是UglifyJS的语法解析器。该模块一般情况下只在开发环境中里使用。

### <a name="introduction-dependencies"></a>依赖

* 动态依赖：无
* 静态依赖：无

## <a name="import-module"></a>引入Jscex解析器模块

首先我们必须[引入核心组件](../core/)，之后再基于这个对象初始化解析器模块。

### <a name="import-module-nodejs"></a>Node.js

如果您使用的是Node.js，可以直接使用[Node Package Manager](http://npmjs.org/)（即npm命令）安装最新的jscex-parser包：

    npm install jscex-parser

然后便可以在脚本中引入该组件：

    var Jscex = require("jscex"); // 引入核心组件
    require("jscex-parser").init(); // 引入并初始化Jscex解析器模块

不过一般说来，在Node.js环境中我们无需手动引入并初始化该模块，在定义其他模块时它可以被Jscex核心组件内置包管理器自动加载，具体内容请参考[核心组件](../core/)相关内容。

### <a name="import-module-browser"></a>浏览器

如果您要在浏览器里使用Jscex解析器模块，则需要在页面中引入jscex-parser-x.y.z.js文件：

    <!-- 核心组件 -->
    <script src="jscex-x.y.z.js"></script>

    <!-- 解析器模块 -->
    <script src="jscex-parser-x.y.z.js"></script>

至此，Jscex根对象已经包括了使用解析器模块所需的所有成员。该做法也适用于各类**没有**实现CommonJS等包加载规范的JavaScript运行环境。

### <a name="import-module-others"></a>其他环境

Jscex自动支持一些其他的包加载规范。假如当前JavaScript运行环境实现了这些规范，则Jscex会自动采用这些规范。详细信息请参考“[包引入](../importing.html)”相关内容。