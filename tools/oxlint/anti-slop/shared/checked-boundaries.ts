import type { ESTree, Scope, SourceCode, Variable } from "@oxlint/plugins";

import { resolveVariable } from "./scope.ts";

export type RuntimeFunction = ESTree.ArrowFunctionExpression | ESTree.Function;

export function isRuntimeFunction(node: ESTree.Node): node is RuntimeFunction {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration" || node.type === "FunctionExpression";
}

function singleReturn(owner: RuntimeFunction): ESTree.Expression | null {
  if (owner.body === null) return null;
  if (owner.body.type !== "BlockStatement") return owner.body;
  if (owner.body.body.length !== 1) return null;
  const statement = owner.body.body[0];
  return statement.type === "ReturnStatement" ? statement.argument : null;
}

function parameterBinding(owner: RuntimeFunction, source: SourceCode): Variable | null {
  if (owner.params.length !== 1 || owner.params[0].type !== "Identifier") return null;
  const parameter = owner.params[0];
  if (parameter.typeAnnotation?.typeAnnotation.type !== "TSUnknownKeyword") return null;
  const binding = source.getDeclaredVariables(owner).find((variable) => variable.identifiers.includes(parameter));
  if (!binding || binding.references.some((reference) => reference.isWrite())) return null;
  return binding;
}

function lexicalBinding(node: ESTree.Node, source: SourceCode): Variable | null {
  if (node.type !== "Identifier") return null;
  let scope: Scope | null = source.getScope(node);
  while (scope !== null) {
    const variable = scope.set.get(node.name);
    if (variable) return variable;
    scope = scope.upper;
  }
  return null;
}

function isSubject(node: ESTree.Node, binding: Variable, source: SourceCode): boolean {
  return node.type === "Identifier" && lexicalBinding(node, source) === binding;
}

function globalBuiltin(node: ESTree.Node, name: string, source: SourceCode): boolean {
  return node.type === "Identifier" && node.name === name && (lexicalBinding(node, source)?.defs.length ?? 0) === 0;
}

function conjunction(node: ESTree.Expression): ESTree.Expression[] {
  return node.type === "LogicalExpression" && node.operator === "&&"
    ? [...conjunction(node.left), ...conjunction(node.right)] : [node];
}

function typeofComparison(node: ESTree.Expression, binding: Variable, source: SourceCode, kind: string): ESTree.UnaryExpression | null {
  if (node.type !== "BinaryExpression" || node.operator !== "===") return null;
  const probe = node.left.type === "UnaryExpression" ? node.left : node.right;
  const literal = probe === node.left ? node.right : node.left;
  return probe.type === "UnaryExpression" && probe.operator === "typeof" &&
    isSubject(probe.argument, binding, source) && literal.type === "Literal" && literal.value === kind ? probe : null;
}

function finiteCheck(node: ESTree.Expression, binding: Variable, source: SourceCode): boolean {
  return node.type === "CallExpression" && !node.optional && node.arguments.length === 1 &&
    isSubject(node.arguments[0], binding, source) && node.callee.type === "MemberExpression" &&
    !node.callee.computed && !node.callee.optional && node.callee.property.type === "Identifier" &&
    node.callee.property.name === "isFinite" && globalBuiltin(node.callee.object, "Number", source);
}

function optionalUnknownObject(type: ESTree.TSType, source: SourceCode): boolean {
  if (type.type === "TSTypeReference" && globalBuiltin(type.typeName, "Readonly", source) && type.typeArguments?.params.length === 1)
    return optionalUnknownObject(type.typeArguments.params[0], source);
  return type.type === "TSTypeLiteral" && type.members.every((member) =>
    member.type === "TSPropertySignature" && member.optional && !member.computed &&
    member.typeAnnotation?.typeAnnotation.type === "TSUnknownKeyword");
}

function nonNull(node: ESTree.Expression, binding: Variable, source: SourceCode): boolean {
  return node.type === "BinaryExpression" && node.operator === "!==" &&
    ((isSubject(node.left, binding, source) && node.right.type === "Literal" && node.right.value === null) ||
     (isSubject(node.right, binding, source) && node.left.type === "Literal" && node.left.value === null));
}

function nonArray(node: ESTree.Expression, binding: Variable, source: SourceCode): boolean {
  if (node.type !== "UnaryExpression" || node.operator !== "!" || node.argument.type !== "CallExpression") return false;
  const call = node.argument;
  return !call.optional && call.arguments.length === 1 && isSubject(call.arguments[0], binding, source) &&
    call.callee.type === "MemberExpression" && !call.callee.computed && !call.callee.optional &&
    call.callee.property.type === "Identifier" && call.callee.property.name === "isArray" && globalBuiltin(call.callee.object, "Array", source);
}

/** Conservative proof, not a general validator verifier. Unsupported bodies fail closed. */
export function checkedPredicateProbe(owner: RuntimeFunction, source: SourceCode): ESTree.UnaryExpression | null {
    if (owner.async || owner.generator) return null;
  const predicate = owner.returnType?.typeAnnotation;
  const binding = parameterBinding(owner, source);
  const returned = singleReturn(owner);
  if (!binding || !returned || predicate?.type !== "TSTypePredicate" || predicate.asserts ||
      predicate.parameterName.type !== "Identifier" || predicate.parameterName.name !== binding.name || !predicate.typeAnnotation) return null;
  const contract = predicate.typeAnnotation.typeAnnotation;
  const terms = conjunction(returned);
  const primitiveKinds = new Map<string, string>([["TSStringKeyword", "string"], ["TSNumberKeyword", "number"], ["TSBooleanKeyword", "boolean"], ["TSBigIntKeyword", "bigint"], ["TSSymbolKeyword", "symbol"]]);
  const kind = primitiveKinds.get(contract.type);
  if (kind) {
    const probe = typeofComparison(terms[0], binding, source, kind);
    return probe && terms.slice(1).every((term) => kind === "number" && finiteCheck(term, binding, source)) ? probe : null;
  }
  if (!optionalUnknownObject(contract, source) || terms.length !== 3) return null;
  const probe = typeofComparison(terms[0], binding, source, "object");
  return probe && nonNull(terms[1], binding, source) && nonArray(terms[2], binding, source) ? probe : null;
}

/** Accept only same-binding, checked primitive input/null decoders; no inferred names or casts. */
export function isCheckedInputDecoder(owner: RuntimeFunction, parameterName: string, source: SourceCode): boolean {
    if (owner.async || owner.generator) return false;
  const binding = parameterBinding(owner, source);
  const returned = singleReturn(owner);
  const contract = owner.returnType?.typeAnnotation;
  if (!binding || binding.name !== parameterName || returned?.type !== "ConditionalExpression" ||
      !isSubject(returned.consequent, binding, source) || returned.alternate.type !== "Literal" || returned.alternate.value !== null ||
      returned.test.type !== "CallExpression" || returned.test.optional || returned.test.arguments.length !== 1 ||
      !isSubject(returned.test.arguments[0], binding, source) || returned.test.callee.type !== "Identifier" ||
      contract?.type !== "TSUnionType" || contract.types.length !== 2) return false;
  const validator = resolveVariable(source, returned.test.callee);
  if (!validator || validator.defs.length !== 1 || validator.references.some((reference) => reference.isWrite())) return false;
  const declaration = validator.defs[0].node;
  if (declaration.type !== "FunctionDeclaration" || !checkedPredicateProbe(declaration, source)) return false;
  const predicate = declaration.returnType?.typeAnnotation;
  if (predicate?.type !== "TSTypePredicate" || !predicate.typeAnnotation) return false;
  const validatedType = predicate.typeAnnotation.typeAnnotation;
  // Matching primitive syntax has no alias-resolution ambiguity. Domain validators require deeper proof.
  return ["TSStringKeyword", "TSNumberKeyword", "TSBooleanKeyword", "TSBigIntKeyword", "TSSymbolKeyword"].includes(validatedType.type) &&
    contract.types.some((type) => type.type === validatedType.type) && contract.types.some((type) => type.type === "TSNullKeyword");
}
