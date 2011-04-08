/** @define {boolean} */
var JSCEX_DEBUG = true;

/**
 * Defined in global, no "var".
 */
Jscex = (function () {

    var builderVar = "$_builder_$";

    /**
     * @constructor
     */
    function CodeGenerator(builderName) {
        this._builderName = builderName;
        this._binder = Jscex.builders[builderName]["binder"];
        this._normalMode = false;
        this._indentLevel = 0;
    }
    CodeGenerator.prototype = {

        _write: function (s) {
            this._buffer.push(s);
            return this;
        },

        _writeLine: function (s) {
            this._write(s)._write("\n")
            return this;
        },

        _writeIndents: function () {
            for (var i = 0; i < this._indentLevel; i++) {
                this._write("    ");
            }
            return this;
        },

        generate: function (ast) {
            this._buffer = [];

            var params = ast[2], statements = ast[3];

            this._writeLine("function (" + params.join(", ") + ") {");
            this._indentLevel++;

            this._writeIndents()
                ._writeLine("var " + builderVar + " = Jscex.builders[" + JSON.stringify(this._builderName) + "];");
            this._writeIndents()
                ._writeLine("return " + builderVar + ".Start(this, function () {");
            this._indentLevel++;

            this._visitStatements(statements);
            this._indentLevel--;

            this._writeIndents()
                ._writeLine("});");
            this._indentLevel--;

            this._writeLine("}");

            return this._buffer.join("");
        },

        _getBindInfo: function (stmt) {

            function checkBindArgs(args) {
                if (args.length != 1) {
                    throw new Error("Bind expression must has one and only one arguments.");
                }
            }

            var type = stmt[0];
            if (type == "stat") {
                var expr = stmt[1];
                if (expr[0] == "call") {
                    var callee = expr[1];
                    if (callee[0] == "name" && callee[1] == this._binder) {
                        if (JSCEX_DEBUG) {
                            checkBindArgs(expr[2]);
                        }
                        return {
                            expression: expr[2][0],
                            argName: "",
                            isReturn: false
                        };
                    }
                }
            } else if (type == "var") {
                var defs = stmt[1];
                if (defs.length == 1) {
                    var item = defs[0];
                    var name = item[0];
                    var expr = item[1];
                    if (expr && expr[0] == "call") {
                        var callee = expr[1];
                        if (callee[0] == "name" && callee[1] == this._binder) {
                            if (JSCEX_DEBUG) {
                                checkBindArgs(expr[2]);
                            }
                            return {
                                expression: expr[2][0],
                                argName: name,
                                isReturn: false
                            };                            
                        }
                    }
                }
            } else if (type == "return") {
                var expr = stmt[1];
                if (expr && expr[0] == "call") {
                    var callee = expr[1];
                    if (callee[0] == "name" && callee[1] == this._binder) {
                        if (JSCEX_DEBUG) {
                            checkBindArgs(expr[2]);
                        }
                        return {
                            expression: expr[2][0],
                            argName: "$$__$$__",
                            isReturn: true 
                        };                            
                    }
                }
            }

            return null;
        },

        _visitStatements: function (statements, index) {
            if (arguments.length <= 1) index = 0;

            if (index >= statements.length) {
                this._writeIndents()
                    ._writeLine("return " + builderVar + ".Normal();");
                return this;
            }

            var stmt = statements[index];
            var bindInfo = this._getBindInfo(stmt);

            if (bindInfo) {
                this._writeIndents()
                    ._write("return " + builderVar + ".Bind(")._visit(bindInfo.expression)._writeLine(", function (" + bindInfo.argName + ") {");
                this._indentLevel++;

                if (bindInfo.isReturn) {
                    this._writeIndents()
                        ._writeLine("return " + builderVar + ".Return(" + bindInfo.argName + ");");
                } else {
                    this._visitStatements(statements, index + 1);
                }
                this._indentLevel--;

                this._writeIndents()
                    ._writeLine("});");

            } else {

                var type = stmt[0];
                if (type == "return" || type == "break" || type == "continue" || type == "throw") {
                    this._writeIndents()
                        ._visit(stmt)._writeLine();
                } else if (type == "while" || type == "try" || type == "if" || type == "for" || type == "do") {
                    var isLast = (index == statements.length - 1);
                    if (isLast) {
                        this._writeIndents()
                            ._write("return ")._visit(stmt)._writeLine(";");
                    } else {
                        this._writeIndents()
                            ._writeLine("return " + builderVar + ".Combine(")
                        this._indentLevel++;
                        
                        this._writeIndents()
                            ._visit(stmt)._writeLine(",")
                            ._writeIndents()
                            ._writeLine(builderVar + ".Delay(function () {")
                        this._indentLevel++;

                        this._visitStatements(statements, index + 1);
                        this._indentLevel--;

                        this._writeIndents()
                            ._writeLine("})");
                        this._indentLevel--;

                        this._writeIndents()
                            ._writeLine(");");
                    }
                } else {
                    this._writeIndents()
                        ._visit(stmt)._writeLine()
                        ._visitStatements(statements, index + 1);
                }
            }

            return this;
        },

        _visitStatementsNormally: function (statements) {
            for (var i = 0, len = statements.length; i < len; i++) {
                this._writeIndents()
                    ._visit(statements[i])._writeLine();
            }
        },

        _visitFunction: function (ast) {
            var normalMode = this._normalMode;
            this._normalMode = true;

            var funcName = ast[1];
            var args = ast[2];
            var statements = ast[3];
            
            this._writeLine("function " + funcName + "(" + args.join(", ") + ") {")
            this._indentLevel++;

            this._visitStatementsNormally(statements);
            this._indentLevel--;

            this._writeIndents()
                ._write("}");

            this._normalMode = normalMode;
        },

        _visit: function (ast) {

            var type = ast[0];

            function throwUnsupportedError() {
                throw new Error('"' + type + '" is not currently supported.');
            }

            var visitor = null;
            if (this._normalMode) {
                visitor = this._visitors[type + "_n"];
                if (!visitor) {
                    visitor = this._visitors[type];
                }
            } else {
                visitor = this._visitors[type];
            }

            if (visitor) {
                visitor.call(this, ast);
            } else if (JSCEX_DEBUG) {
                throwUnsupportedError();
            }

            return this;
        },

        _visitors: {

            "call": function (ast) {
                this._visit(ast[1])._write("(");

                var args = ast[2];
                for (var i = 0, len = args.length; i < len; i++) {
                    this._visit(args[i]);
                    if (i < len - 1) this._write(", ");
                }

                this._write(")");
            },

            "name": function (ast) {
                this._write(ast[1]);
            },

            "object": function (ast) {
                this._write("{");
                
                var items = ast[1];
                for (var i = 0, len = items.length; i < len; i++) {
                    this._write(JSON.stringify(items[i][0]) + ": ")._visit(items[i][1]);
                    if (i < len - 1) this._write(", ");
                }

                this._write("}");
            },

            "array": function (ast) {
                this._write("[");

                var items = ast[1];
                for (var i = 0, len = items.length; i < len; i++) {
                    this._visit(items[i]);
                    if (i < len - 1) this._write(", ");
                }

                this._write("]");
            },

            "num": function (ast) {
                this._write(ast[1]);
            },

            "regexp": function (ast) {
                this._write("/" + ast[1] + "/" + ast[2]);
            },

            "string": function (ast) {
                this._write(JSON.stringify(ast[1]));
            },

            "for": function (ast) {
        
                this._write(builderVar)._writeLine(".Delay(function() {");
                this._indentLevel++;
                
                var setup = ast[1];
                if (setup) {
                    this._writeIndents();
                    if (setup[0] == "var") {
                        this._visit(setup);
                    } else {
                        this._visit(setup)._write(";");
                    }
                    this._writeLine();
                }
                
                this._writeIndents()
                    ._writeLine("return " + builderVar + ".Loop(")
                this._indentLevel++;
                
                this._writeIndents();
                var condition = ast[2];
                if (condition) {
                    this._writeLine("function () {");
                    this._indentLevel++;

                    this._writeIndents()
                        ._write("return ")._visit(condition)._writeLine(";");
                    this._indentLevel--;

                    this._writeIndents()
                        ._writeLine("},");
                } else {
                    this._writeLine("null,");
                }
                
                this._writeIndents()
                    ._writeLine("function () { ");
                this._indentLevel++;

                var update = ast[3];
                if (update) {
                    this._writeIndents()
                        ._visit(update)._writeLine(";");
                }
                this._indentLevel--;

                this._writeIndents()
                    ._writeLine("},")
                    ._writeIndents()
                    ._writeLine(builderVar + ".Delay(function () {");
                this._indentLevel++;

                var body = ast[4];
                this._visit(body);
                this._indentLevel--;
                
                this._writeIndents()
                    ._writeLine("}),")
                    ._writeIndents()
                    ._writeLine("false");
                this._indentLevel--;
                
                this._writeIndents()
                    ._writeLine(");");
                this._indentLevel--;

                this._writeIndents()
                    ._write("})");
            },

            "for_n": function (ast) {
                this._write("for (");

                var setup = ast[1];
                if (setup) {
                    this._visit(setup);
                    if (setup[0] != "var") {
                        this._write("; ");
                    } else {
                        this._write(" ");
                    }
                } else {
                    this._write("; ");
                }

                var condition = ast[2];
                if (condition) this._visit(condition);
                this._write("; ");

                var update = ast[3];
                if (update) this._visit(update);
                this._writeLine(") {");
                this._indentLevel++;

                var body = ast[4];
                this._visit(body);
                this._indentLevel--;

                this._writeIndents()
                    ._write("}");
            },

            "var": function (ast) {
                this._write("var ");

                var items = ast[1];
                for (var i = 0, len = items.length; i < len; i++) {
                    this._write(items[i][0] + " = ")._visit(items[i][1]);
                    if (i < len - 1) this._write(", ");
                }

                this._write(";");
            },

            "binary": function (ast) {
                var op = ast[1], left = ast[2], right = ast[3];

                function needBracket(item) {
                    var type = item[0];
                    return !(type == "num" || type == "name" || type == "dot");
                }

                var lnb = (!JSCEX_DEBUG) || needBracket(left);
                if (lnb) {
                    this._write("(")._visit(left)._write(") ");
                } else {
                    this._visit(left)._write(" ");
                }

                this._write(op);

                var rnb = (!JSCEX_DEBUG) || needBracket(right);
                if (rnb) {
                    this._write(" (")._visit(right)._write(")");
                } else {
                    this._write(" ")._visit(right);
                }
            },

            "sub": function (ast) {
                var prop = ast[1], index = ast[2];

                function needBracket() {
                    return !(prop[0] == "name")
                }

                var nb = (!JSCEX_DEBUG) || needBracket();
                if (nb) {
                    this._write("(")._visit(prop)._write(")[")._visit(index)._write("]");
                } else {
                    this._visit(prop)._write("[")._visit(index)._write("]");
                }
            },

            "unary-postfix": function (ast) {
                var op = ast[1];
                var item = ast[2];
                this._visit(item)._write(op);
            },

            "unary-prefix": function (ast) {
                var op = ast[1];
                var item = ast[2];
                this._write(op)._visit(item);
            },

            "assign": function (ast) {
                var op = ast[1];
                var name = ast[2];
                var value = ast[3];

                this._visit(name);
                if ((typeof op) == "string") {
                    this._write(" " + op + "= ");
                } else {
                    this._write(" = ");
                }
                this._visit(value);
            },

            "stat": function (ast) {
                this._visit(ast[1])._write(";");
            },

            "dot": function (ast) {
                function needBracket() {
                    var leftOp = ast[1][0];
                    return !(leftOp == "dot" || leftOp == "name");
                }

                var nb = (!JSCEX_DEBUG) || needBracket();
                if (nb) {
                    this._write("(")._visit(ast[1])._write(").")._write(ast[2]);
                } else {
                    this._visit(ast[1])._write(".")._write(ast[2]);
                }
            },

            "block": function (ast) {
                this._visitStatements(ast[1]);
            },

            "block_n": function (ast) {
                this._visitStatementsNormally(ast[1]);
            },

            "new": function (ast) {
                var ctor = ast[1];

                this._write("new ")._visit(ctor)._write("(");

                var args = ast[2];
                for (var i = 0, len = args.length; i < len; i++) {
                    this._visit(args[i]);
                    if (i < len - 1) this._write(", ");
                }

                this._write(")");
            },

            "while": function (ast) {
                
                this._write(builderVar)
                    ._writeLine(".Loop(");
                this._indentLevel++;

                this._writeIndents()
                    ._writeLine("function () {");
                this._indentLevel++;

                var condition = ast[1];
                this._writeIndents()
                    ._write("return ")._visit(condition)._writeLine(";");
                this._indentLevel--;

                this._writeIndents()
                    ._writeLine("},")
                    ._writeIndents()
                    ._writeLine("null, ")
                    ._writeIndents()
                    ._writeLine(builderVar + ".Delay(function() {");
                this._indentLevel++;

                var body = ast[2];
                this._visit(body);
                this._indentLevel--;

                this._writeIndents()
                    ._writeLine("}),")
                    ._writeIndents()
                    ._writeLine("false");
                this._indentLevel--;

                this._writeIndents()
                    ._write(")");
            },

            "while_n": function (ast) {
                var condition = ast[1];
                var body = ast[2];

                this._write("while (")._visit(condition)._writeLine(") {");
                this._indentLevel++;

                this._visit(body);
                this._indentLevel--;

                this._writeIndents();
                this._write("}");
            },

            "do": function (ast) {
                this._write(builderVar)
                    ._writeLine(".Loop(");
                this._indentLevel++;

                var condition = ast[1];
                this._writeIndents()
                    ._write("function () { return ")._visit(condition)._writeLine("; },")
                    ._writeIndents()
                    ._writeLine("null, ")
                    ._writeIndents()
                    ._writeLine(builderVar + ".Delay(function () {");
                this._indentLevel++;

                var body = ast[2];
                this._visit(body);
                this._indentLevel--;

                this._writeIndents()
                    ._writeLine("}),")
                    ._writeIndents()
                    ._writeLine("true");
                this._indentLevel--;

                this._writeIndents()
                    ._write(")");
            },

            "do_n": function (ast) {
                var condition = ast[1];
                var body = ast[2];

                this._writeLine("do {");
                this._indentLevel++;

                this._visit(body);
                this._indentLevel--;

                this._writeIndents()
                    ._write("} while (")._visit(condition)._write(")");
            },

            "if": function (ast) {

                this._write(builderVar)
                    ._writeLine(".Delay(function() {");
                this._indentLevel++;

                this._writeIndents();
                while (true) {
                    var condition = ast[1];
                    this._write("if (")._visit(condition)._writeLine(") {");
                    this._indentLevel++;
                    
                    var thenPart = ast[2];
                    this._visit(thenPart);
                    this._indentLevel--;

                    this._writeIndents()
                        ._write("} else ");

                    var elsePart = ast[3];
                    if (elsePart && elsePart[0] == "if") {
                        ast = elsePart;
                    } else {
                        break;
                    }
                }
    
                this._writeLine("{");
                this._indentLevel++;

                var elsePart = ast[3];
                if (elsePart) {
                    this._visit(elsePart);
                } else {
                    this._writeIndents()
                        ._writeLine("return " + builderVar + ".Normal();");
                }
                this._indentLevel--;

                this._writeIndents()
                    ._writeLine("}");
                this._indentLevel--;

                this._writeIndents()
                    ._write("})");
            },

            "if_n": function (ast) {

                var condition = ast[1];
                var thenPart = ast[2];

                this._write("if (")._visit(condition)._writeLine(") {");
                this._indentLevel++;

                this._visit(thenPart);
                this._indentLevel--;

                this._writeIndents()
                    ._write("}");

                var elsePart = ast[3];
                if (elsePart) {
                    if (elsePart[0] == "if") {
                        this._write(" else ")._visit(elsePart);
                    } else {
                        this._writeLine(" else {")
                        this._indentLevel++;

                        this._visit(elsePart)
                        this._indentLevel--;

                        this._writeIndents()
                            ._write("}");
                    }
                }
            },

            "return": function (ast) {
                this._write("return " + builderVar + ".Return(");

                var value = ast[1];
                if (value) this._visit(value);
                
                this._write(");");
            },

            "return_n": function (ast) {
                this._write("return");
                var value = ast[1];
                if (value) this._write(" ")._visit(value);
                this._write(";");
            },

            "break": function (ast) {
                this._write("return " + builderVar + ".Break();");
            },

            "break_n": function (ast) {
                this._write("break;");
            },

            "continue": function (ast) {
                this._write("return " + builderVar + ".Continue();");
            },

            "continue_n": function (ast) {
                this._write("continue;");
            },

            "throw": function (ast) {
                this._write("return " + builderVar + ".Throw(").visit(ast[1])._write(");");
            },

            "throw_n": function (ast) {
                this._write("throw ")._visit(ast[1])._write(";");
            },

            "conditional": function (ast) {
                this._write("(")._visit(ast[1])._write(") ? (" + ast[2] + ") : (")._visit(ast[3])._write(")");
            },

            "try": function (ast) {
                this._write(builderVar)
                    ._writeLine(".Try(");
                this._indentLevel++;

                this._writeIndents()
                    ._writeLine(builderVar + ".Delay(function () {")
                this._indentLevel++;

                this._visitStatements(ast[1]);
                this._indentLevel--;

                this._writeIndents()
                    ._write("}), ");

                var catchClause = ast[2];
                this._writeLine("function (" + catchClause[0] + ") {");
                this._indentLevel++;

                this._visitStatements(catchClause[1]);
                this._indentLevel--;

                this._writeIndents()
                    ._writeLine("}");
                this._indentLevel--;

                this._writeIndents()
                    ._write(")");
            },

            "try_n": function (ast) {

                this._writeLine("try {");
                this._indentLevel++;

                this._visitStatementsNormally(ast[1]);
                this._indentLevel--;

                var catchClause = ast[2];
                this._writeIndents()
                    ._writeLine("} catch (" + catchClause[0] + ") {")
                this._indentLevel++;

                this._visitStatementsNormally(catchClause[1]);
                this._indentLevel--;

                this._writeIndents()
                    ._writeLine("}");
            },

            "defun": function (ast) {
                this._visitFunction(ast);
            },

            "function": function (ast) {
                this._visitFunction(ast);
            }
        }
    };

    function _log(funcCode, newCode) {
        if (typeof(window) != "undefined" && typeof(console) != "undefined" && console.log) {
            console.log(funcCode + "\n\n>>>\n\n" + newCode);
        }
    }

    function generate(builder, funcAst) {
        var generator = new CodeGenerator(builder);
        return generator.generate(funcAst);
    }

    function compile(builder, func) {
        var funcCode = func.toString();

        var code = "var f = " + funcCode + ";";
        var ast = UglifyJS.parse(code);

        // [ "toplevel", [ [ "var", [ [ "f", [...] ] ] ] ] ]
        var funcAst = ast[1][0][1][0][1];
        var newCode = generate(builder, funcAst);

        if (JSCEX_DEBUG) {
            _log(funcCode, newCode);
        }
        
        return "(" + newCode + ");"
    };

    return {
        "generate": generate,
        "compile": compile,
        "builders": {}
    };

})();
