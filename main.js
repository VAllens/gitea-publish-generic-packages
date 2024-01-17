import fs from "fs";
import { Blob } from "buffer";
import * as glob from "glob";

import core from "@actions/core";

import gitea from "gitea-api";
import path from 'path';

/**
 * Extends packages service, adding publish generic packages api method support
 *
 * @class PackagesServiceEx
 * @extends {gitea.PackageService}
 */
class PackagesServiceEx extends gitea.PackageService {
  /**
   * The http request instance.
   * the base url of the api, e.g. https://try.gitea.io/api
   * @private
   * @type {gitea.BaseHttpRequest}
   * @memberof PackagesServiceEx
   */
  baseHttpRequest;

  /**
   * Creates an instance of Packages service.
   * @param {gitea.BaseHttpRequest} httpRequest
   * @param {gitea.BaseHttpRequest} baseHttpRequest
   * @memberof PackagesServiceEx
   */
  constructor(httpRequest, baseHttpRequest) {
    super(httpRequest);
    this.baseHttpRequest = baseHttpRequest;
  }

  /**
   * try get package files from generic package registry
   *
   * @private
   * @param {string} owner The owner of the package.
   * @param {string} packageName The package name. It can contain only lowercase letters (a-z), uppercase letter (A-Z), numbers (0-9), dots (.), hyphens (-), pluses (+), or underscores (_).
   * @param {string} packageVersion The package version, a non-empty string without trailing or leading whitespaces.
   * @return {gitea.CancelablePromise<Array<gitea.PackageFile>>} 
   * @memberof PackagesServiceEx
   */
  async trylistGenericPackageFiles(owner, packageName, packageVersion) {
    try {
      const response = await this.listPackageFiles({
        owner: owner,
        type: 'generic',
        name: packageName,
        version: packageVersion
      });
      return response;
    } catch (error) {
      core.warning(error);
      return [];
    }
  }

  /**
   * Publish zip files to generic package registry
   *
   * @param {string} owner The owner of the package.
   * @param {string} packageName The package name. It can contain only lowercase letters (a-z), uppercase letter (A-Z), numbers (0-9), dots (.), hyphens (-), pluses (+), or underscores (_).
   * @param {string} packageVersion The package version, a non-empty string without trailing or leading whitespaces.
   * @param {Array<string>} zip_files The zip package files.
   * @returns {gitea.CancelablePromise<void>}
   * @throws {gitea.ApiError}
   * @memberof PackagesServiceEx
   */
  async publishGenericPackages(owner, packageName, packageVersion, zip_files) {
    core.debug(`Uploading these generic packages: ${zip_files.join(', ')}`);

    const genericPackages = await this.trylistGenericPackageFiles(owner, packageName, packageVersion);
    if (!Array.isArray(genericPackages) || genericPackages.length === 0) {
      core.debug(`The version [${packageVersion}] does not have any generic packages, uploading...`);
    } else {
      core.debug(`The version [${packageVersion}] already has these generic packages: ${genericPackages.map((genericPackage) => genericPackage.name).join(', ')}`);
    }

    for (const filepath of zip_files) {
      const fileName = path.basename(filepath);

      // Check if the file exists. If exists, skip.
      const isExists = Array.isArray(genericPackages) && genericPackages.length > 0 && genericPackages.some((genericPackage) => {
        return genericPackage.name === fileName;
      });
      if (isExists) {
        core.warning(`Generic package [${fileName}] already exists, skip.`);
        continue;
      } else {
        core.debug(`Generic package [${fileName}] does not exist, uploading...`);
      }

      // Upload the file.
      const content = fs.readFileSync(filepath);
      const blob = new Blob([content]);
      await this.baseHttpRequest.request({
        method: 'PUT',
        url: '/packages/{owner}/generic/{name}/{version}/{filename}',
        path: {
          'owner': owner,
          'name': packageName,
          'version': packageVersion,
          'filename': fileName
        },
        body: blob,
        errors: {
          400: `The package name and/or version and/or file name are invalid.`,
          409: `A file with the same name exist already in the package.`
        }
      });
      core.debug(`Successfully uploaded generic package ${filepath}`);
    }
  }
}

async function run() {
  try {
    const api_url = core.getInput("api_url");
    const owner = core.getInput("owner");
    const package_name = core.getInput("package_name");
    const package_version = core.getInput("package_version");
    const files = core.getInput("files");
    const token = core.getInput("token");

    // if api_url is empty or null or undefined.
    if (!api_url) {
      core.setFailed(`api_url is required.`);
      return;
    }

    // if owner is empty or null or undefined.
    if (!owner) {
      core.setFailed(`owner is required.`);
      return;
    }

    // if package_name is empty or null or undefined.
    if (!package_name) {
      core.setFailed(`package_name is required.`);
      return;
    }

    // if package_version is empty or null or undefined.
    if (!package_version) {
      core.setFailed(`package_version is required.`);
      return;
    }

    // if files is empty or null or undefined.
    if (!files) {
      core.setFailed(`files is required.`);
      return;
    }

    // if token is empty or null or undefined.
    if (!token) {
      core.setFailed(`token is required.`);
      return;
    }

    // Get all files using file patterns.
    const file_patterns = files.split('\n')
    const all_files = paths(file_patterns);
    if (all_files.length == 0) {
      core.setFailed(`${file_patterns} not include valid file.`);
      return;
    }

    // The publish package method is an api that is not publicly available in api/v1
    const baseApiUrl = api_url.indexOf('/v1') > 0 ? api_url.slice(0, api_url.indexOf('/v1')) : api_url;
    const internal_gitea_client = new gitea.GiteaApi({
      BASE: baseApiUrl,
      WITH_CREDENTIALS: true,
      TOKEN: token
    });

    const gitea_client = new gitea.GiteaApi({
      BASE: api_url,
      WITH_CREDENTIALS: true,
      TOKEN: token
    });

    const packagesService = new PackagesServiceEx(gitea_client.request, internal_gitea_client.request);
    await packagesService.publishGenericPackages(owner, package_name, package_version, all_files);
    core.info(`🎉 Successfully uploaded generic packages: ${all_files.join(', ')}`);
  } catch (error) {
    core.setFailed(error);
  }
}

/**
 * 
 * @param {Array<String>} patterns 
 * @returns {Array<String>}
 */
function paths(patterns) {
  return patterns.reduce((acc, pattern) => {
    return acc.concat(
      glob.sync(pattern).filter((path) => fs.statSync(path).isFile())
    );
  }, []);
};

run();