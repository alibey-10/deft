/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as directory from "../directory.js";
import type * as github from "../github.js";
import type * as githubUrls from "../githubUrls.js";
import type * as seed from "../seed.js";
import type * as skillDiscovery from "../skillDiscovery.js";
import type * as skillDiscoveryNode from "../skillDiscoveryNode.js";
import type * as skillDiscoveryRules from "../skillDiscoveryRules.js";
import type * as skillScan from "../skillScan.js";
import type * as skillScanNode from "../skillScanNode.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  directory: typeof directory;
  github: typeof github;
  githubUrls: typeof githubUrls;
  seed: typeof seed;
  skillDiscovery: typeof skillDiscovery;
  skillDiscoveryNode: typeof skillDiscoveryNode;
  skillDiscoveryRules: typeof skillDiscoveryRules;
  skillScan: typeof skillScan;
  skillScanNode: typeof skillScanNode;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
