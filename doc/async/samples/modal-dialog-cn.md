# 模态对话框 - Jscex异步示例

## 描述

如今前端应用的交互特性越来越多，而模态对话框是其中最常见的使用案例。由于JavaScript和HTML的限制，各种用户交互的参与都必须以回调函数（或是事件，而事件其实也可以认为是回调函数的一种）。但实际上，这种做法在很多情况下不能说是最直接且最易用的表达方式。

本文将通过一个模态对话框与AJAX操作交互相结合的示例，演示如何使用[Jscex异步模块](../README-cn.md)来轻松直接地表达结合紧密的一系列异步逻辑。

## 需求

“删除”是前端应用中常见的操作。由于包含一定危险性，在进行删除之前，我们经常会向用户进行确认，然后再向服务器端发送一个AJAX请求删除数据。这个示例的需求便由此而来，如下：

1. 点击“清空”按钮，弹出确认对话框。
2. 用户选择“确定”或“取消”
   * 选择“确定”
     1. 发送AJAX请求至服务器端，完成后，
     2. 给用户以提示信息。
   * 选择“取消”，则给用户以提示信息。

为了保证用户体验，无论是“确定/取消”对话框，还是提示给用户看的信息，都不允许使用浏览器内置的`alert`和`confim`方法。也正是这点，增加了实现这一功能的复杂度。

## 实现

方便期间，我们使用jQuery来实现模态对话框及AJAX操作，相关绑定请参考“[jQuery绑定](jquery-bindings-cn.md)”。

由于逻辑从按钮点击开始，我们便在按钮的`onclick`事件里调用一个异步方法：

    <input type="button" value="Empty" onclick="emptyAsync().start();" />

`emptyAsync`的实现是：

    var emptyAsync = eval(Jscex.compile("async", function () {        // 弹出“确定/取消”对话框        var ok = false;                    $await($("#dialog-confirm").dialogAsync({            modal: true,            buttons: {                "OK": function () {                    ok = true;                    $(this).dialog("close");                },                "Cancel": function () {                    $(this).dialog("close");                }            }        }));        if (ok) {            // 用户选择“确定”，则发出AJAX请求            var response = $await($.ajaxAsync({                url: "modal-dialog.html",                dataType: "text"            }));            
            // 给用户以信息提示            $("#emptyLength").text(response.data.length);            $await($("#dialog-emptied").dialogAsync({ modal: true }));        } else {
            // 用户选择“取消”，则给用户以提示信息            $await($("#dialog-canceled").dialogAsync({ modal: true }));        }        console.log("done");    }))

首先，我们使用`dialogAsync`函数弹出一个对话框，这是一个异步方法，将在对话框关闭时完成。在用户点击“确认”按钮时，我们将`ok`变量设为true。对话框关闭之后，如果`ok`变量的值为true，发起一个AJAX请求，将返回结果显示在页面上，再显示下一个模态对话框。如果`ok`为false，这意味着用户没有点击“确认”按钮，则用另一个模态对话框提示用户。

使用Jscex之后，程序员只需使用最传统的方式编写逻辑，而不会由于异步函数所需要的各式回调将逻辑打散，使程序既易写，又易读。

## 相关链接

* [在线演示](http://files.zhaojie.me/jscex/samples/async/modal-dialog.html)
* [完整代码](../../../samples/async/modal-dialog.html)
* [jQuery绑定](jquery-bindings-cn.md)
* [Jscex异步模块](../README-cn.md)