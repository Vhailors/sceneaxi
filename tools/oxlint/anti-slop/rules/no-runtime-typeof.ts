import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

import { checkedPredicateProbe, isRuntimeFunction } from "../shared/checked-boundaries.ts";

import { resolveVariable } from "../shared/scope.ts";
import type { Scope, SourceCode } from "@oxlint/plugins";

/** A synchronous non-asserts TSTypePredicate function may probe its own parameters
 * when the probe participates in the returned conjunction, compares with ===,
 * and the compared kind is consistent with the annotated contract:
 * primitive keywords must match their kind exactly; named (imported/builtin)
 * non-primitive contracts and the object keyword accept only "object"/"function".
 * Anonymous type-literal shells, shadowed Readonly, and shadowed Number/Array
 * inside the conjunction stay under the strict checked-predicate proof. */
function annotationKinds(contract: ESTree.TSType, source: SourceCode): ReadonlyArray<string> | null {
  if (contract.type === "TSStringKeyword") return ["string"];
  if (contract.type === "TSNumberKeyword") return ["number"];
  if (contract.type === "TSBooleanKeyword") return ["boolean"];
  if (contract.type === "TSBigIntKeyword") return ["bigint"];
  if (contract.type === "TSSymbolKeyword") return ["symbol"];
  if (contract.type === "TSObjectKeyword") return ["object", "function"];
  if (contract.type === "TSIntersectionType") {
    const kinds: string[] = [];
    for (const member of contract.types) {
      const memberKinds = annotationKinds(member, source);
      if (memberKinds === null) continue;
      kinds.push(...memberKinds);
    }
    return kinds.length > 0 ? kinds : null;
  }
  if (contract.type === "TSTypeReference" && contract.typeName.type === "Identifier") {
    const resolved = resolveVariable(source, contract.typeName);
    if (resolved === null) return ["object", "function"];
    const shadowed = resolved.defs.some((definition) => definition.type !== "ImportBinding" && definition.type !== "ImportSpecifier" && definition.type !== "ImportDefaultSpecifier" && definition.type !== "ImportNamespaceSpecifier");
    return shadowed ? null : ["object", "function"];
  }
  return null;
}

function enclosingReturnedConjunction(node: ESTree.UnaryExpression, owner: RuntimeFunction): ESTree.Expression | null {
  let current: ESTree.Node = node;
  while (current.parent !== undefined && current.parent !== null && current.parent !== owner) {
    const parent: ESTree.Node = current.parent;
    if (parent.type === "LogicalExpression" && parent.operator !== "&&") return null;
    if (parent.type === "ReturnStatement") {
      if (owner.body === null || owner.body.type !== "BlockStatement") return null;
      return owner.body.body[owner.body.body.length - 1] === parent ? (parent as ESTree.ReturnStatement).argument : null;
    }
    if (parent.type === "ArrowFunctionExpression" || parent.type === "FunctionDeclaration" || parent.type === "FunctionExpression" || parent.type === "IfStatement" || parent.type === "ConditionalExpression") return null;
    current = parent;
  }
  if (owner.body === null) return null;
  if (owner.body.type !== "BlockStatement") return owner.body as ESTree.Expression;
  return null;
}

function builtinUnshadowed(node: ESTree.Node, name: string, source: SourceCode): boolean {
  if (node.type !== "Identifier" || node.name !== name) return false;
  const resolved = resolveVariable(source, node);
  return resolved === null || resolved.defs.length === 0;
}

function conjunctionBuiltinsUnshadowed(expression: ESTree.Expression, source: SourceCode): boolean {
  if (expression.type === "LogicalExpression") return conjunctionBuiltinsUnshadowed(expression.left, source) && conjunctionBuiltinsUnshadowed(expression.right, source);
  if (expression.type === "BinaryExpression") return conjunctionBuiltinsUnshadowed(expression.left, source) && conjunctionBuiltinsUnshadowed(expression.right, source);
  if (expression.type === "UnaryExpression") return conjunctionBuiltinsUnshadowed(expression.argument, source);
  if (expression.type === "CallExpression" && expression.callee.type === "MemberExpression" && expression.callee.object.type === "Identifier") {
    const object = expression.callee.object;
    return object.name === "Number" || object.name === "Array" ? builtinUnshadowed(object, object.name, source) : true;
  }
  return true;
}

function guardParameterProbe(owner: RuntimeFunction, node: ESTree.UnaryExpression, source: SourceCode): boolean {
  if (owner.async || owner.generator) return false;
  const predicate = owner.returnType?.typeAnnotation;
  if (predicate === null || predicate === undefined || predicate.type !== "TSTypePredicate" || predicate.asserts) return false;
  if (predicate.parameterName.type !== "Identifier") return false;
  const parameters = source.getDeclaredVariables(owner).filter((variable) =>
    variable.defs.some((definition) => definition.type === "Parameter") && !variable.references.some((reference) => reference.isWrite()));
  const subject = parameters.find((variable) => variable.name === predicate.parameterName.name);
  if (subject === undefined) return false;
  const comparison = node.parent;
  if (comparison.type !== "BinaryExpression" || (comparison.operator !== "===" && comparison.operator !== "!==")) return false;
  if (comparison.operator === "!==") return false;
  if (!(node.argument.type === "Identifier" && node.argument.name === subject.name)) return false;
  const literal = comparison.left === node ? comparison.right : comparison.left;
  if (literal.type !== "Literal" || typeof literal.value !== "string") return false;
  const contract = predicate.typeAnnotation === undefined ? undefined : predicate.typeAnnotation.typeAnnotation;
  const kinds = contract === undefined ? null : annotationKinds(contract, source);
  if (kinds === null || !kinds.includes(literal.value)) return false;
  const returned = enclosingReturnedConjunction(node, owner);
  if (returned === null) return false;
  return conjunctionBuiltinsUnshadowed(returned, source);
}

function isCheckedPredicateProbe(node: ESTree.UnaryExpression, source: SourceCode): boolean {
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (isRuntimeFunction(current)) return guardParameterProbe(current, node, source) || checkedPredicateProbe(current, source) === node;
    current = current.parent;
  }
  return false;
}

/** Return whether typeof safely probes for the existence of a possibly absent binding. */
function isExistenceProbe(node: ESTree.UnaryExpression): boolean {
	const parent = node.parent;
	if (parent.type !== "BinaryExpression") return false;
	if (!["===", "!==", "==", "!="].includes(parent.operator)) return false;
	const other = parent.left === node ? parent.right : parent.left;
	return other.type === "Literal" && other.value === "undefined";
}

/** Disallow runtime typeof checks that narrow unparsed values instead of decoding them. */
export const noRuntimeTypeofRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow runtime typeof checks; external values must be decoded into meaningful types at their I/O boundary.",
		},
		messages: {
			runtimeTypeof:
				"A `typeof` check narrows a representation without establishing its contract. Parse input at its I/O boundary, then branch on the domain value.",
		},
		schema: [
			{
				type: "object",
				properties: {
					allowInTypeGuards: { type: "boolean" },
				},
				additionalProperties: false,
			},
		],
		defaultOptions: [{ allowInTypeGuards: false }],
	},
	createOnce(context) {
		return {
			UnaryExpression(node) {
				const option = context.options?.[0];
				const allowInTypeGuards =
					typeof option === "object" &&
					option !== null &&
					!Array.isArray(option) &&
					option.allowInTypeGuards === true;
				if (
					node.operator === "typeof" &&
					!isExistenceProbe(node) &&
					(!allowInTypeGuards || !isCheckedPredicateProbe(node, context.sourceCode))
				) {
					context.report({ node, messageId: "runtimeTypeof" });
				}
			},
		};
	},
});
