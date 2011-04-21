/** @define {boolean} */
var JSCEX_DEBUG = true;

/**
 * Defined in global, no "var".
 */
Jscex = (function () {

    var builderVar = "$$_builder_$$";

    /**
     * @constructor
     */
    function JscexTreeGenerator(builderName) {
        this._binder = Jscex.builders[builderName].binder;
        this._tempVarSeed = 0;
        this._root = null;
        this._currStmts = null;
    }
    JscexTreeGenerator.prototype = {

        generate: function (ast) {

            var params = ast[2], statements = ast[3];

            this._root = { type: "delay", stmts: [] };
            this._currStmts = this._root.stmts;

            this._visitStatements(statements);

            return this._root;
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
                            argName: "$$_result_$$",
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
                this._currStmts.push({ type: "normal" });
                return this;
            }

            var stmt = statements[index];
            var bindInfo = this._getBindInfo(stmt);

            if (bindInfo) {
                var bindStmt = { type: "bind", info: bindInfo };
                this._currStmts.push(bindStmt);

                if (bindInfo.isReturn) {

                } else {
                    bindStmt.stmts = [];

                    var currStmts = this._currStmts;
                    this._currStmts = bindStmt.stmts;
                    this._visitStatements(statements, index + 1);
                    this._currStmts = currStmts;
                }

            } else {
                var type = stmt[0];
                if (type == "return" || type == "break" || type == "continue" || type == "throw") {

                    this._currStmts.push({ type: type, stmt: stmt });

                } else if (type == "while" || type == "try" || type == "if" ||
                            type == "for" || type == "do" || type == "for-in") {

                    var isLast = (index == statements.length - 1);
                    if (isLast) {
                        this._visit(stmt);
                    } else {

                        var combineStmt = {
                            type: "combine",
                            first: { type: "delay", stmts: [] },
                            second: { type: "delay", stmts: [] }
                        };
                        this._currStmts.push(combineStmt);

                        var currStmts = this._currStmts;
                        this._currStmts = combineStmt.first.stmts;
                        this._visit(stmt);

                        this._currStmts = combineStmt.second.stmts;
                        this._visitStatements(statements, index + 1);
                        this._currStmts = currStmts;
                    }
                } else {

                    this._currStmts.push({ type: "raw", stmt: stmt });

                    this._visitStatements(statements, index + 1);
                }
            }

            return this;
        },

        _visit: function (ast) {

            var type = ast[0];

            function throwUnsupportedError() {
                throw new Error('"' + type + '" is not currently supported.');
            }

            var visitor = this._visitors[type];

            if (visitor) {
                visitor.call(this, ast);
            } else if (JSCEX_DEBUG) {
                throwUnsupportedError();
            }

            return this;
        },

        _visitBody: function (ast) {
            if (ast[0] == "block") {
                this._visit(ast);
            } else {
                this._visitStatements([ast]);
            }
        },

        _visitors: {

            "for": function (ast) {

                var delayStmt = { type: "delay", stmts: [] };
                this._currStmts.push(delayStmt);
        
                var setup = ast[1];
                if (setup) {
                    delayStmt.stmts.push({ type: "raw", stmt: setup });
                }
                
                var loopStmt = { type: "loop", bodyFirst: false, bodyStmt: { type: "delay", stmts: [] } };
                delayStmt.stmts.push(loopStmt);
                
                var condition = ast[2];
                if (condition) {
                    loopStmt.condition = condition;
                }
                
                var update = ast[3];
                if (update) {
                    loopStmt.update = update;
                }

                var currStmts = this._currStmts;
                this._currStmts = loopStmt.bodyStmt.stmts;
                var body = ast[4];
                this._visitBody(body);
                this._currStmts = currStmts;
            },

            "for-in": function (ast) {

                var membersVar = "$$_members_$$_" + this._tempVarSeed;
                var indexVar = "$$_index_$$_" + this._tempVarSeed;
                var memVar = "$$_mem_$$_" + this._tempVarSeed;
                this._tempVarSeed++;

                var obj = ast[3];
    
                var delayStmt = { type: "delay", stmts: [] };
                this._currStmts.push(delayStmt);

                // var members = [];
                delayStmt.stmts.push({ type: "raw", stmt: [
                    "var",
                    [
                        [
                            membersVar,
                            [
                                "array",
                                []
                            ]
                        ]
                    ]
                ] });

                // for (var mem in obj) members.push(mem);
                delayStmt.stmts.push({ type: "raw", stmt: [
                    "for-in",
                    [
                        "var",
                        [
                            [
                                memVar
                            ]
                        ]
                    ],
                    [
                        "name",
                        [
                            memVar
                        ]
                    ],
                    obj,
                    [
                        "stat",
                        [
                            "call",
                            [
                                "dot",
                                [
                                    "name",
                                    membersVar
                                ],
                                "push"
                            ],
                            [
                                [
                                    "name",
                                    memVar
                                ]
                            ]
                        ]
                    ]
                ] });

                
                // var index = 0;
                delayStmt.stmts.push({ type: "raw", stmt: [
                    "var",
                    [
                        [
                            indexVar,
                            [
                                "num",
                                0
                            ]
                        ]
                    ]
                ] });

                // index < members.length
                var condition = [
                    "binary",
                    "<",
                    [
                        "name",
                        indexVar
                    ],
                    [
                        "dot",
                        [
                            "name",
                            membersVar
                        ],
                        "length"
                    ]
                ];

                // index++
                var update = [
                    "unary-postfix",
                    "++",
                    [
                        "name",
                        indexVar
                    ]
                ]

                var loopStmt = {
                    type: "loop",
                    bodyFirst: false,
                    update: update,
                    condition: condition,
                    bodyStmt: { type: "delay", stmts: [] }
                };
                delayStmt.stmts.push(loopStmt);

                var varName = ast[2][1]; // ast[2] == ["name", m]
                if (ast[1][0] == "var") {
                    loopStmt.bodyStmt.stmts.push({ type: "raw", stmt: [
                        "var",
                        [
                            [
                                varName,
                                [
                                    "sub",
                                    [
                                        "name",
                                        membersVar
                                    ],
                                    [
                                        "name",
                                        indexVar
                                    ]
                                ]
                            ]
                        ]
                    ] });
                } else {
                    loopStmt.bodyStmt.stmts.push({ type: "raw", stmt: [
                        "stat",
                        [
                            "assign",
                            true,
                            [
                                "name",
                                varName
                            ],
                            [
                                "sub",
                                [
                                    "name",
                                    membersVar
                                ],
                                [
                                    "name",
                                    indexVar
                                ]
                            ]
                        ]
                    ] });
                }

                var currStmts = this._currStmts;
                this._currStmts = loopStmt.bodyStmt.stmts;
                var body = ast[4];
                this._visitBody(body);
                this._currStmts = currStmts;        
            },

            "block": function (ast) {
                this._visitStatements(ast[1]);
            },

            "while": function (ast) {
                var loopStmt = { type: "loop", bodyFirst: false, bodyStmt: { type: "delay", stmts: [] } };
                this._currStmts.push(loopStmt);

                var condition = ast[1];
                loopStmt.condition = condition;

                var currStmts = this._currStmts;
                this._currStmts = loopStmt.bodyStmt.stmts;
                var body = ast[2];
                this._visitBody(body);
                this._currStmts = currStmts;
            },

            "do": function (ast) {
                var loopStmt = { type: "loop", bodyFirst: true, bodyStmt: { type: "delay", stmts: [] } };
                this._currStmts.push(loopStmt);

                var condition = ast[1];
                loopStmt.condition = condition;

                var currStmts = this._currStmts;
                this._currStmts = loopStmt.bodyStmt.stmts;
                var body = ast[2];
                this._visitBody(body);
                this._currStmts = currStmts;
            },

            "if": function (ast) {

                var ifStmt = { type: "if", conditionStmts: [] };
                this._currStmts.push(ifStmt);
                // var delayStmt = { type: "delay", stmts: [ifStmt] };
                // this._currStmts.push(delayStmt);

                while (true) {
                    var condition = ast[1];
                    var condStmt = { cond: condition, stmts: [] };
                    ifStmt.conditionStmts.push(condStmt);

                    var currStmts = this._currStmts;
                    this._currStmts = condStmt.stmts;
                    var thenPart = ast[2];
                    this._visit(thenPart);
                    this._currStmts = currStmts;

                    var elsePart = ast[3];
                    if (elsePart && elsePart[0] == "if") {
                        ast = elsePart;
                    } else {
                        break;
                    }
                }
    
                var elsePart = ast[3];
                if (elsePart) {
                    ifStmt.elseStmts = [];

                    var currStmts = this._currStmts
                    this._currStmts = ifStmt.elseStmts;
                    this._visit(elsePart);
                    this._currStmts = currStmts;
                }
            },

            "try": function (ast) {

                var tryStmt = { type: "try", bodyStmt: { type: "delay", stmts: [] } };
                this._currStmts.push(tryStmt);

                var currStmts = this._currStmts;
                this._currStmts = tryStmt.bodyStmt.stmts;
                var bodyStatements = ast[1];
                this._visitStatements(bodyStatements);
                this._currStmts = currStmts;

                var catchClause = ast[2];
                if (catchClause) {
                    var exVar = catchClause[0];
                    tryStmt.exVar = exVar;
                    tryStmt.catchStmts = [];

                    currStmts = this._currStmts;
                    this._currStmts = tryStmt.catchStmts;
                    this._visitStatements(catchClause[1]);
                    this._currStmts = currStmts;
                }

                var finallyStatements = ast[3];
                if (finallyStatements) {
                    tryStmt.finallyStmt = { type: "delay", stmts: [] };

                    currStmts = this._currStmts;
                    this._currStmts = tryStmt.finallyStmt.stmts;
                    this._visitStatements(finallyStatements);
                    this._currStmts = currStmts;
                }
            }
        }
    }

    /**
     * @constructor
     */
    function CodeGenerator(builderName) {
        this._builderName = builderName;
        this._binder = Jscex.builders[builderName].binder;
        this._normalMode = false;
        this._indentLevel = 0;
        this._tempVarSeed = 0;
    }
    CodeGenerator.prototype = {
        _write: function (s) {
            this._buffer.push(s);
            return this;
        },

        _writeLine: function (s) {
            this._write(s)._write("\n");
            return this;
        },

        _writeIndents: function () {
            for (var i = 0; i < this._indentLevel; i++) {
                this._write("    ");
            }
            return this;
        },

        generate: function (params, jscexAst) {
            this._buffer = [];

            this._writeLine("(function (" + params.join(", ") + ") {");
            this._indentLevel++;

            this._writeIndents()
                ._writeLine("var " + builderVar + " = Jscex.builders[" + JSON.stringify(this._builderName) + "];");

            this._writeIndents()
                ._writeLine("return " + builderVar + ".Start(this,");
            this._indentLevel++;

            this._writeIndents()
                ._visitJscex(jscexAst)
                ._writeLine();
            this._indentLevel--;

            this._writeIndents()
                ._writeLine(");");
            this._indentLevel--;

            this._write("})");

            return this._buffer.join("");
        },

        _visitJscex: function (ast) {
            this._jscexVisitors[ast.type].call(this, ast);
            return this;
        },

        _visitRaw: function (ast) {
            var type = ast[0];

            function throwUnsupportedError() {
                throw new Error('"' + type + '" is not currently supported.');
            }

            var visitor = this._rawVisitors[type];

            if (visitor) {
                visitor.call(this, ast);
            } else if (JSCEX_DEBUG) {
                throwUnsupportedError();
            }

            return this;
        },

        _visitJscexStatements: function (statements) {
            for (var i = 0; i < statements.length; i++) {
                var stmt = statements[i];

                if (stmt.type == "raw" || stmt.type == "if") {
                    this._writeIndents()
                        ._visitJscex(stmt)._writeLine();
                } else if (stmt.type == "delay") {
                    this._visitJscexStatements(stmt.stmts);
                } else {
                    this._writeIndents()
                        ._write("return ")._visitJscex(stmt)._writeLine(";");
                }
            }
        },

        _visitRawStatements: function (statements) {
            for (var i = 0; i < statements.length; i++) {
                this._writeIndents()
                    ._visitRaw(statements[i])._writeLine();
            }
        },

        _visitRawBody: function (body) {
            if (body[0] == "block") {
                this._visitRaw(body);
            } else {
                this._writeLine();
                this._indentLevel++;

                this._writeIndents()
                    ._visitRaw(body);
                this._indentLevel--;
            }

            return this;
        },

        _visitRawFunction: function (ast) {
            var funcName = ast[1] || "";
            var args = ast[2];
            var statements = ast[3];
            
            this._writeLine("function " + funcName + "(" + args.join(", ") + ") {")
            this._indentLevel++;

            this._visitRawStatements(statements);
            this._indentLevel--;

            this._writeIndents()
                ._write("}");
        },

        _jscexVisitors: {
            "delay": function (ast) {
                if (ast.stmts.length == 1) {
                    var subStmt = ast.stmts[0];
                    switch (subStmt.type) {
                        case "delay":
                        case "combine":
                        case "normal":
                        case "break":
                        case "continue":
                        case "loop":
                        case "try":
                            this._visitJscex(subStmt);
                            return;
                        case "return":
                            // debugger;
                            if (!subStmt.stmt[1]) {
                                this._visitJscex(subStmt);
                                return;
                            }
                    }
                }

                this._writeLine(builderVar + ".Delay(function () {");
                this._indentLevel++;

                this._visitJscexStatements(ast.stmts);
                this._indentLevel--;

                this._writeIndents()
                    ._write("})");
            },

            "combine": function (ast) {
                this._writeLine(builderVar + ".Combine(");
                this._indentLevel++;

                this._writeIndents()
                    ._visitJscex(ast.first)._writeLine(",");
                this._writeIndents()
                    ._visitJscex(ast.second)._writeLine();
                this._indentLevel--;

                this._writeIndents()
                    ._write(")");
            },

            "loop": function (ast) {
                this._writeLine(builderVar + ".Loop(");
                this._indentLevel++;

                if (ast.condition) {
                    this._writeIndents()
                        ._writeLine("function () {");
                    this._indentLevel++;

                    this._writeIndents()
                        ._write("return ")._visitRaw(ast.condition)._writeLine(";");
                    this._indentLevel--;

                    this._writeIndents()
                        ._writeLine("},");
                } else {
                    this._writeIndents()._writeLine("null,");
                }

                if (ast.update) {
                    this._writeIndents()
                        ._writeLine("function () {");
                    this._indentLevel++;

                    this._writeIndents()
                        ._visitRaw(ast.update)._writeLine(";");
                    this._indentLevel--;

                    this._writeIndents()
                        ._writeLine("},");
                } else {
                    this._writeIndents()._writeLine("null,");
                }

                this._writeIndents()
                    ._visitJscex(ast.bodyStmt)._writeLine(",");

                this._writeIndents()
                    ._writeLine(ast.bodyFirst);
                this._indentLevel--;

                this._writeIndents()
                    ._write(")");
            },

            "raw": function (ast) {
                this._visitRaw(ast.stmt);
            },

            "bind": function (ast) {
                var info = ast.info;
                this._write(builderVar + ".Bind(")._visitRaw(info.expression)._writeLine(", function (" + info.argName + ") {");
                this._indentLevel++;

                if (info.isReturn) {
                    this._writeIndents()
                        ._writeLine("return " + builderVar + ".Return(" + info.argName + ");");
                } else {
                    this._visitJscexStatements(ast.stmts);
                }
                this._indentLevel--;

                this._writeIndents()
                    ._write("})");
            },

            "if": function (ast) {

                for (var i = 0; i < ast.conditionStmts.length; i++) {
                    var stmt = ast.conditionStmts[i];
                    
                    this._write("if (")._visitRaw(stmt.cond)._writeLine(") {");
                    this._indentLevel++;

                    this._visitJscexStatements(stmt.stmts);
                    this._indentLevel--;

                    this._writeIndents()
                        ._write("} else ");
                }

                this._writeLine("{");
                this._indentLevel++;

                if (ast.elseStmts) {
                    this._visitJscexStatements(ast.elseStmts);
                } else {
                    this._writeIndents()
                        ._writeLine("return " + builderVar + ".Normal();");
                }

                this._indentLevel--;

                this._writeIndents()
                    ._write("}");
            },

            "try": function (ast) {
                this._writeLine(builderVar + ".Try(");
                this._indentLevel++;

                this._writeIndents()
                    ._visitJscex(ast.bodyStmt)._writeLine(",");

                if (ast.catchStmts) {
                    this._writeIndents()
                        ._writeLine("function (" + ast.exVar + ") {");
                    this._indentLevel++;

                    this._visitJscexStatements(ast.catchStmts);
                    this._indentLevel--;

                    this._writeIndents()
                        ._writeLine("},");
                } else {
                    this._writeIndents()
                        ._writeLine("null,");
                }

                if (ast.finallyStmt) {
                    this._writeIndents()
                        ._visitJscex(ast.finallyStmt)._writeLine();
                } else {
                    this._writeIndents()
                        ._writeLine("null");
                }
                this._indentLevel--;

                this._writeIndents()
                    ._write(")");
            },

            "normal": function (ast) {
                this._write(builderVar + ".Normal()");
            },

            "throw": function (ast) {
                this._write(builderVar + ".Throw()");
            },

            "break": function (ast) {
                this._write(builderVar + ".Break()");
            },

            "continue": function (ast) {
                this._write(builderVar + ".Continue()");
            },

            "return": function (ast) {
                this._write(builderVar + ".Return(");
                if (ast.stmt[1]) this._visitRaw(ast.stmt[1]);
                this._write(")");
            }
        },

        _rawVisitors: {
            "var": function (ast) {
                this._write("var ");

                var items = ast[1];
                for (var i = 0; i < items.length; i++) {
                    this._write(items[i][0]);
                    if (items[i].length > 1) {
                        this._write(" = ")._visitRaw(items[i][1]);
                    }
                    if (i < items.length - 1) this._write(", ");
                }

                this._write(";");
            },

            "seq": function (ast) {
                for (var i = 1; i < ast.length; i++) {
                    this._visitRaw(ast[i]);
                    if (i < ast.length - 1) this._write(", "); 
                }
            },

            "binary": function (ast) {
                var op = ast[1], left = ast[2], right = ast[3];

                function needBracket(item) {
                    var type = item[0];
                    return !(type == "num" || type == "name" || type == "dot");
                }

                var lnb = (!JSCEX_DEBUG) || needBracket(left);
                if (lnb) {
                    this._write("(")._visitRaw(left)._write(") ");
                } else {
                    this._visitRaw(left)._write(" ");
                }

                this._write(op);

                var rnb = (!JSCEX_DEBUG) || needBracket(right);
                if (rnb) {
                    this._write(" (")._visitRaw(right)._write(")");
                } else {
                    this._write(" ")._visitRaw(right);
                }
            },

            "sub": function (ast) {
                var prop = ast[1], index = ast[2];

                function needBracket() {
                    return !(prop[0] == "name")
                }

                var nb = (!JSCEX_DEBUG) || needBracket();
                if (nb) {
                    this._write("(")._visitRaw(prop)._write(")[")._visitRaw(index)._write("]");
                } else {
                    this._visitRaw(prop)._write("[")._visitRaw(index)._write("]");
                }
            },

            "unary-postfix": function (ast) {
                var op = ast[1];
                var item = ast[2];
                this._visitRaw(item)._write(op);
            },

            "unary-prefix": function (ast) {
                var op = ast[1];
                var item = ast[2];
                this._write(op)._visitRaw(item);
            },

            "assign": function (ast) {
                var op = ast[1];
                var name = ast[2];
                var value = ast[3];

                this._visitRaw(name);
                if ((typeof op) == "string") {
                    this._write(" " + op + "= ");
                } else {
                    this._write(" = ");
                }
                this._visitRaw(value);
            },

            "stat": function (ast) {
                this._visitRaw(ast[1])._write(";");
            },

            "dot": function (ast) {
                function needBracket() {
                    var leftOp = ast[1][0];
                    return !(leftOp == "dot" || leftOp == "name");
                }

                var nb = (!JSCEX_DEBUG) || needBracket();
                if (nb) {
                    this._write("(")._visitRaw(ast[1])._write(").")._write(ast[2]);
                } else {
                    this._visitRaw(ast[1])._write(".")._write(ast[2]);
                }
            },

            "new": function (ast) {
                var ctor = ast[1];

                this._write("new ")._visitRaw(ctor)._write("(");

                var args = ast[2];
                for (var i = 0, len = args.length; i < len; i++) {
                    this._visitRaw(args[i]);
                    if (i < len - 1) this._write(", ");
                }

                this._write(")");
            },

            "call": function (ast) {
                this._visitRaw(ast[1])._write("(");

                var args = ast[2];
                for (var i = 0; i < args.length; i++) {
                    this._visitRaw(args[i]);
                    if (i < args.length - 1) this._write(", ");
                }

                this._write(")");
            },

            "name": function (ast) {
                this._write(ast[1]);
            },

            "object": function (ast) {
                this._write("{");
                
                var items = ast[1];
                for (var i = 0; i < items.length; i++) {
                    this._write(JSON.stringify(items[i][0]) + ": ")._visitRaw(items[i][1]);
                    if (i < items.length - 1) this._write(", ");
                }

                this._write("}");
            },

            "array": function (ast) {
                this._write("[");

                var items = ast[1];
                for (var i = 0; i < items.length; i++) {
                    this._visitRaw(items[i]);
                    if (i < items.length - 1) this._write(", ");
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

            "function": function (ast) {
                this._visitRawFunction(ast);
            },

            "defun": function (ast) {
                this._visitRawFunction(ast);
            },

            "return": function (ast) {
                this._write("return");
                var value = ast[1];
                if (value) this._write(" ")._visitRaw(value);
                this._write(";");
            },
            
            "for": function (ast) {
                this._write("for (");

                var setup = ast[1];
                if (setup) {
                    this._visitRaw(setup);
                    if (setup[0] != "var") {
                        this._write("; ");
                    } else {
                        this._write(" ");
                    }
                } else {
                    this._write("; ");
                }

                var condition = ast[2];
                if (condition) this._visitRaw(condition);
                this._write("; ");

                var update = ast[3];
                if (update) this._visitRaw(update);
                this._write(") ");

                var body = ast[4];
                this._visitRawBody(body);
            },

            "for-in": function (ast) {
                this._write("for (");

                var declare = ast[1];
                if (declare[0] == "var") { // declare == ["var", [["m"]]]
                    this._write("var " + declare[1][0][0]);
                } else {
                    this._visitRaw(declare);
                }
                
                this._write(" in ")._visitRaw(ast[3])._write(") ");

                var body = ast[4];
                this._visitRawBody(body);
            },

            "block": function (ast) {
                this._writeLine("{")
                this._indentLevel++;

                this._visitRawStatements(ast[1]);
                this._indentLevel--;

                this._writeIndents()
                    ._write("}");
            },

            "while": function (ast) {
                var condition = ast[1];
                var body = ast[2];

                this._write("while (")._visitRaw(condition)._write(") ")._visitRawBody(body);
            },

            "do": function (ast) {
                var condition = ast[1];
                var body = ast[2];

                this._write("do ")._visitRawBody(body)._writeLine()
                    ._writeIndents()
                    ._write("while (")._visitRaw(condition)._write(");");
            },

            "if": function (ast) {

                var condition = ast[1];
                var thenPart = ast[2];

                this._write("if (")._visitRaw(condition)._writeLine(") {");
                this._indentLevel++;

                this._visitRaw(thenPart);
                this._indentLevel--;

                this._writeIndents()
                    ._write("}");

                var elsePart = ast[3];
                if (elsePart) {
                    if (elsePart[0] == "if") {
                        this._write(" else ")._visitRaw(elsePart);
                    } else {
                        this._writeLine(" else {")
                        this._indentLevel++;

                        this._visitRaw(elsePart)
                        this._indentLevel--;

                        this._writeIndents()
                            ._write("}");
                    }
                }
            },

            "break": function (ast) {
                this._write("break;");
            },

            "continue": function (ast) {
                this._write("continue;");
            },

            "throw": function (ast) {
                this._write("throw ")._visitRaw(ast[1])._write(";");
            },

            "conditional": function (ast) {
                this._write("(")._visitRaw(ast[1])._write(") ? (" + ast[2] + ") : (")._visitRaw(ast[3])._write(")");
            },

            "try": function (ast) {

                this._writeLine("try {");
                this._indentLevel++;

                this._visitRawStatements(ast[1]);
                this._indentLevel--;

                var catchClause = ast[2];
                var finallyStatements = ast[3];

                if (catchClause) {
                    this._writeIndents()
                        ._writeLine("} catch (" + catchClause[0] + ") {")
                    this._indentLevel++;

                    this._visitRawStatements(catchClause[1]);
                    this._indentLevel--;
                }

                if (finallyStatements) {
                    this._writeIndents()
                        ._writeLine("} finally {");
                    this._indentLevel++;

                    this._visitRawStatements(finallyStatements);
                    this._indentLevel--;
                }                

                this._writeIndents()
                    ._writeLine("}");
            },

            "switch": function (ast) {
                // TODO: print raw
            }
        }
    }

    function _log(funcCode, newCode) {
        var config = Jscex.config || {};
        if (config.logger) {
            config.logger(funcCode + "\n\n>>>\n\n" + newCode);
        }
    }

    function compile(builderName, func) {
        var funcCode = func.toString();

        var code = "var f = " + funcCode + ";";
        var ast = UglifyJS.parse(code);

        // [ "toplevel", [ [ "var", [ [ "f", [...] ] ] ] ] ]
        var funcAst = ast[1][0][1][0][1];

        var jscexTreeGenerator = new JscexTreeGenerator(builderName);
        var jscexAst = jscexTreeGenerator.generate(funcAst);

        var codeGenerator = new CodeGenerator(builderName);
        var newCode = codeGenerator.generate(funcAst[2], jscexAst);

        if (JSCEX_DEBUG) {
            _log(funcCode, newCode);
        }
        
        return newCode;
    };

    return {
        "compile": compile,
        "builders": {}
    };

})();

if (JSCEX_DEBUG && typeof(console) != "undefined" && console.log) {
    Jscex.config = { logger: function (s) { console.log(s); } };
}
