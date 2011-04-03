var Jscex = (function () {

    /**
     * @constructor
     */
    function CodeGenerator(builder) {
        this._builderName = builder["name"];
        this._binder = builder["binder"];
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

            this._write("function (")
                ._write(params.join(", "))
                ._writeLine(") {");
            this._indentLevel++;

            this._writeIndents()
                ._write("return ")
                ._write(this._builderName)
                ._writeLine(".Start(this, function () {");
            this._indentLevel++;

            this._visitStatements(statements);
            this._indentLevel--;

            this._writeIndents()
                ._writeLine("});");
            this._indentLevel--;

            this._writeLine("};");

            return this._buffer.join("");
        },

        _getBindInfo: function (stmt) {

            function checkBindArgs(args) {
                if (args.length != 1) {
                    throw new Error("Bind expression must has one and only one arguments.");
                }
            }

            var type = stmt[0];
            // debugger;
            if (type == "stat") {
                var expr = stmt[1];
                if (expr[0] == "call") {
                    var callee = expr[1];
                    if (callee[0] == "name" && callee[1] == this._binder) {
                        checkBindArgs(expr[2]);
                        return {
                            expression: expr[2][0],
                            argName: "" 
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
                    ._write("return ")
                    ._write(this._builderName)
                    ._writeLine(".Normal();");
                return this;
            }

            var stmt = statements[index];
            var bindInfo = this._getBindInfo(stmt);

            if (bindInfo) {
                this._writeIndents()
                    ._write("return ")
                    ._write(this._builderName)
                    ._write(".Bind(")
                    ._visit(bindInfo.expression)
                    ._write(", function (")
                    ._write(bindInfo.argName)
                    ._writeLine(") {");
                this._indentLevel++;

                if (bindInfo.isReturn) {
                    this._writeIndents()
                        ._write("return ")
                        ._write(this._builderName)
                        ._write(".Return(")
                        ._write(bindInfo.argName)
                        ._writeLine(");");
                } else {
                    this._visitStatements(statements, index + 1);
                }
                this._indentLevel--;

                this._writeIndents()
                    ._writeLine("});");

            } else {

                var type = stmt[0];
                if (type == "return" || type == "break" || type == "continue" || type == "throw") {
                    this._visit(stmt);
                } else if (type == "while" || type == "try" || type == "if" || type == "for" || type == "do") {
                    var isLast = (index == statements.length - 1);
                    if (isLast) {
                        this._writeIndents()
                            ._write("return ")
                            ._visit(stmt)
                            ._writeLine(";");
                    } else {
                        this._writeIndents()
                            ._write("return ")
                            ._write(this._builderName)
                            ._writeLine(".Combine(");
                        this._indentLevel++;
                        
                        this._writeIndents()
                            ._visit(stmt)
                            ._writeLine(",")
                            ._writeIndents()
                            ._write(this._builderName)
                            ._writeLine(".Delay(function() {");
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
                        ._visit(stmt)
                        ._writeLine()
                        ._visitStatements(statements, index + 1);
                }
            }

            return this;
        },

        _visit: function (ast) {
            var type = ast[0];
            var visitor = this._visitors[type];
            if (visitor) {
                visitor.call(this, ast);
            } else {
                debugger;
                throw new Error("Unsupported type: " + type);
            }

            return this;
        },

        _visitors: {

            "call": function (ast) {
                this._visit(ast[1])
                    ._write("(");

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
                    this._write(JSON.stringify(items[i][0]))._write(": ");
                    this._visit(items[i][1]);
                    if (i < len - 1) this._write(", ");
                }

                this._write("}");
            },

            "num": function (ast) {
                this._write(ast[1]);
            },

            "for": function (ast) {
        
                this._write(this._builderName)
                    ._writeLine(".Delay(function() {");
                this._indentLevel++;
                
                var setup = ast[1];
                if (setup) {
                    this._writeIndents();
                    if (setup[0] == "var") {
                        this._visit(setup);
                    } else {
                        this._visit(setup)
                            ._write(";");
                    }
                    this._writeLine();
                }
                
                this._writeIndents()
                    ._write("return ")
                    ._write(this._builderName)
                    ._writeLine(".Loop(");
                this._indentLevel++;
                
                this._writeIndents();
                var condition = ast[2];
                if (condition) {
                    this._writeLine("function () {");
                    this._indentLevel++;

                    this._writeIndents()
                        ._write("return ")
                        ._visit(condition)
                        ._writeLine(";");
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
                        ._visit(update)
                        ._writeLine(";");
                }
                this._indentLevel--;

                this._writeIndents()
                    ._writeLine("},")
                    ._writeIndents()
                    ._write(this._builderName)
                    ._writeLine(".Delay(function() {");
                this._indentLevel++;

                var bodyBlock = ast[4];
                this._visitStatements(bodyBlock[1]);
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

            "var": function (ast) {
                this._write("var ");

                var items = ast[1];
                for (var i = 0, len = items.length; i < len; i++) {
                    this._write(items[i][0])
                        ._write(" = ")
                        ._visit(items[i][1]);
                    if (i < len - 1) this._write(", ");
                }

                this._write(";");
            },

            "binary": function (ast) {
                var op = ast[1], left = ast[2], right = ast[3];
                this._write("(")._visit(left)._write(") ")
                    ._write(op)
                    ._write(" (")._visit(right)._write(")");
            },

            "assign": function (ast) {
                var op = ast[1];
                var name = ast[2];
                var value = ast[3];

                this._visit(name);
                if ((typeof op) == "string") {
                    this._write(" ")._write(op)._write("= ");
                } else {
                    this._write(" = ");
                }
                this._visit(value);
            },

            "stat": function (ast) {
                this._visit(ast[1])._write(";");
            },

            "dot": function (ast) {
                function needBracket(ast) {
                    var leftOp = ast[1][0];
                    return !(leftOp == "dot" || leftOp == "name");
                }

                var nb = needBracket(ast);
                if (nb) {
                    this._write("(")
                        ._visit(ast[1])
                        ._write(").")
                        ._write(ast[2]);
                } else {
                    this._visit(ast[1])
                        ._write(".")
                        ._write(ast[2]);
                }
            },

            "block": function (ast) {
                this._visitStatements(ast[1]);
            },

            "new": function (ast) {
                var ctor = ast[1];

                this._write("new ")
                    ._visit(ctor)
                    ._write("(");

                var args = ast[2];
                for (var i = 0, len = args.length; i < len; i++) {
                    this._visit(args[i]);
                    if (i < len - 1) this._write(", ");
                }

                this._write(")");
            },

            "while": function (ast) {
                
                this._write(this._builderName)
                    ._writeLine(".Loop(");
                this._indentLevel++;

                this._writeIndents()
                    ._writeLine("function () {");
                this._indentLevel++;

                var condition = ast[1];
                this._writeIndents()
                    ._write("return ")
                    ._visit(condition)
                    ._writeLine(";");
                this._indentLevel--;

                this._writeIndents()
                    ._writeLine("},")
                    ._writeIndents()
                    ._writeLine("null, ")
                    ._writeIndents()
                    ._write(this._builderName)
                    ._writeLine(".Delay(function() {");
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
            }
        }
    };

    function _log(funcCode, newCode) {
        if (typeof(console) != "undefined" && console.log) {
            console.log(funcCode + "\n\n>>>\n\n" + newCode);
        }
    }

    function compile(builder, func) {
        var funcCode = func.toString();

        var code = "var f = " + funcCode + ";";
        var ast = UglifyJS.parse(code);

        // [ "toplevel", [ [ "var", [ [ "f", [...] ] ] ] ] ]
        var funcAst = ast[1][0][1][0][1];

        var generator = new CodeGenerator(builder);
        var newCode = generator.generate(funcAst);

        _log(funcCode, newCode);
        
        return "(function () {\n\nreturn " + newCode + "\n\n})();";
    };

    return { compile: compile };

})();
