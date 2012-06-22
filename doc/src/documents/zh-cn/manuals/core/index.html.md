---
layout: manual-zh-cn
title: 核心组件
---

Jscex核心组件提供了Jscex开发中所需要的辅助方法、日志记录、模块定义等基础功能。在使用其他任何Jscex模块之前，都需要首先加载该核心组件。

## <a name="import-component"></a>引入Jscex核心组件

引入核心组件后将会得到一个Jscex根对象，该对象**必须**赋给上下文中名为`Jscex`的变量。

### <a name="import-component-nodejs"></a>Node.js

如果您使用的是Node.js，可以直接使用[Node Package Manager](http://npmjs.org/)（即npm命令）安装最新的jscex包：

    npm install jscex

然后便可以在脚本中引入该组件：

    var Jscex = require("jscex"); // 一定要使用Jscex作为变量名

### <a name="import-component-browser"></a>浏览器

如果您要在浏览器里使用Jscex异步增强模块，则需要在页面中引入jscex-x.y.z.js文件：

    <script src="jscex-x.y.z.js"></script>

此时异步增强模块会自动为浏览器根对象（即window对象）添加一个名为Jscex的对象。该做法也适用于各类**没有**实现CommonJS等包加载规范的JavaScript运行环境。

### <a name="import-component-others"></a>其他环境

Jscex自动支持一些其他的包加载规范。假如当前JavaScript运行环境实现了这些规范，则Jscex会自动采用这些规范。详细信息请参考“[包引入](../importing.html)”相关内容。