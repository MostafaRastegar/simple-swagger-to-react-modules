const {
  ensureDirectoryExists,
  formatCode,
  NamingStrategy,
} = require("../utils");

// Function to generate Next.js app route file
async function generateAppRouteFile(moduleOutputDir, moduleName, swaggerJson) {
  const modulePaths = Object.keys(swaggerJson.paths);
  const resourcePaths = modulePaths.filter((path) => {
    const pathLower = path.toLowerCase();
    return (
      pathLower.includes(`/${moduleName.toLowerCase()}`) ||
      pathLower.includes(`/${moduleName.toLowerCase()}/`)
    );
  });

  if (resourcePaths.length === 0) {
    // If no specific paths found, use all paths for this module
    resourcePaths.push(...modulePaths);
  }

  // Use NamingStrategy for directory paths
  const { fileName, rawName } = NamingStrategy.getBaseNames(moduleName);
  const appDir = moduleOutputDir
    .replace("/modules/", "/app/")
    .replace(`/modules/${rawName}`, `/${fileName}`);
  await ensureDirectoryExists(appDir);

  // Generate page.tsx
  const pageContent = generatePageFile(moduleName, resourcePaths, swaggerJson);
  await ensureDirectoryExists(appDir);
  const pagePath = `${appDir}/page.tsx`;
  await require("fs").promises.writeFile(pagePath, pageContent);
  console.log(`Generated: ${pagePath}`);

  // Generate view component
  const viewContent = generateViewComponent(
    moduleName,
    resourcePaths,
    swaggerJson
  );
  // Use NamingStrategy for file paths
  const viewPath = `${appDir}/${fileName}.view.tsx`;
  await require("fs").promises.writeFile(viewPath, viewContent);
  console.log(`Generated: ${viewPath}`);
}

// Generate Next.js page.tsx
function generatePageFile(moduleName, resourcePaths, swaggerJson) {
  // Use centralized naming strategy
  const { basePascalName, baseCamelName, fileName } =
    NamingStrategy.getBaseNames(moduleName);
  const viewName = NamingStrategy.viewName(basePascalName);

  return `'use client';

import { Suspense } from 'react';
// import { ContactContextProvider } from './_viewModule/contacts.context';
import { ${viewName} } from './${fileName}.view';

export default function Page() {
  return (
    <Suspense
      fallback={
        <p style={{ textAlign: 'center' }}>loading... on initial request</p>
      }
    >
      <${viewName} />
    </Suspense>
  );
}
`;
}

// Generate view component
function generateViewComponent(moduleName, resourcePaths, swaggerJson) {
  // Use centralized naming strategy
  const { basePascalName, baseCamelName, fileName } =
    NamingStrategy.getBaseNames(moduleName);
  const viewName = NamingStrategy.viewName(basePascalName);
  const presentationName = NamingStrategy.presentationName(basePascalName);
  const storeName = NamingStrategy.storeName(baseCamelName);
  const mainListHookName = NamingStrategy.findMainListHook(
    basePascalName,
    swaggerJson,
    moduleName
  );
  const modelName = getModelNameFromSwagger(moduleName, swaggerJson);

  return `'use client';

import Link from 'next/link';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { Button, type TableColumnsType } from 'antd';
import { ContentEditableTable } from 'papak/kits/ContentEditableTable/default';
import { PageFilterInlineSearch } from '@/components/PageFilterInlineSearch';
import { ${modelName} } from '@/modules/${fileName}/domains/models/${basePascalName}';
import { ${presentationName} } from '@/modules/${fileName}/${fileName}.presentation';
import { ${storeName} } from '@/modules/${fileName}/${fileName}.store';
import AddModal from './_components/AddModal';
import DeleteModal from './_components/DeleteModal';
import EditModal from './_components/EditModal';

export function ${viewName}() {
  const { ${mainListHookName} } = ${presentationName}();
  const getAll${basePascalName} = ${mainListHookName}();
  const data = getAll${basePascalName}.data?.data;

  const columns: TableColumnsType<${modelName}> = [
    ${generateTableColumns(modelName, resourcePaths, swaggerJson, baseCamelName)}
  ];

  return (
    <>
      <PageFilterInlineSearch
        searchBar={false}
        title={
          <div className='flex items-center gap-2'>
            <span>${basePascalName} Management</span>
          </div>
        }
        inlineFilter={() => (
          <div className='flex flex-1 items-center'>
            <div className='mr-auto flex gap-4'>
              <Link href={\`/dashboard/${fileName}/add\`}>
                <Button className='mr-auto px-4 text-sm'>
                  Add Multiple ${basePascalName}
                </Button>
              </Link>
              <Button
                type='primary'
                className='mr-auto px-4 text-sm'
                onClick={() => {
                  ${storeName}.setState({
                    addModalOpen: true,
                  });
                }}
              >
                New ${basePascalName}
              </Button>
            </div>
          </div>
        )}
      />
      <div>
        <ContentEditableTable<${modelName}>
          count={data?.count}
          data={data?.results || []}
          isPending={getAll${basePascalName}.isPending}
          columns={columns}
          rowKey='id'
          paginationPath={\`dashboard/${fileName}\`}
          actions={[]}
        />
      </div>
      <ShowingModals />
    </>
  );
}

const ShowingModals = () => {
  return (
    <>
      <EditModal />
      <AddModal />
      <DeleteModal />
    </>
  );
};
`;
}

// Get model name from swagger definitions
function getModelNameFromSwagger(moduleName, swaggerJson) {
  const definitions =
    swaggerJson.components?.schemas || swaggerJson.definitions || {};
  const definitionKeys = Object.keys(definitions);

  // Find main model for the module (exclude *Request and *List models)
  const mainModel = definitionKeys.find((key) => {
    const keyLower = key.toLowerCase();
    const moduleLower = moduleName.toLowerCase();

    // Look for models matching the module name, excluding *Request and *List models
    return (
      keyLower === moduleLower ||
      keyLower === moduleLower.substring(0, moduleLower.length - 1) || // singular form
      (keyLower.includes(moduleLower) &&
        !keyLower.includes("request") &&
        !keyLower.includes("list"))
    );
  });

  if (mainModel) {
    return mainModel;
  }

  // Fallback: try to find any model not ending with Request or List
  const fallbackModel = definitionKeys.find(
    (key) =>
      !key.toLowerCase().includes("request") &&
      !key.toLowerCase().includes("list") &&
      !key.toLowerCase().includes("enum")
  );

  return fallbackModel || "Entity";
}

// Generate table columns based on model properties
function generateTableColumns(
  modelName,
  resourcePaths,
  swaggerJson,
  moduleCamelCase,
  hasStore
) {
  const definitions =
    swaggerJson.components?.schemas || swaggerJson.definitions || {};
  const model = definitions[modelName];

  if (!model || !model.properties) {
    return `    {
      title: 'ID',
      width: 50,
      dataIndex: 'id',
      key: 'id',
    },`;
  }

  let columns = `    {
      title: 'ID',
      width: 50,
      dataIndex: 'id',
      key: 'id',
    },`;

  Object.entries(model.properties).forEach(([prop, schema]) => {
    if (prop !== "id") {
      const title = prop
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());
      const width = getFieldWidth(prop);

      columns += `
    {
      title: '${title}',
      width: ${width},
      dataIndex: '${prop}',
      key: '${prop}',
    },`;
    }
  });

  columns += `
    {
      title: 'Actions',
      key: 'actions',
      width: 50,
      render(_, record) {
        return (
          <span className='flex items-center gap-4'>
            <IconEdit
              onClick={() => {
                ${moduleCamelCase}Store.setState({
                  selectedRowState: [record],
                  editModalOpen: true,
                });
              }}
              className='cursor-pointer text-gray-700'
            />
            <IconTrash
              onClick={() => {
                ${moduleCamelCase}Store.setState({
                  selectedRowState: [record],
                  deleteModalOpen: true,
                });
              }}
              className='cursor-pointer text-gray-700'
            />
          </span>
        );
      },
    },`;

  return columns;
}

// Get field width based on property name
function getFieldWidth(prop) {
  const propLower = prop.toLowerCase();
  if (
    propLower.includes("description") ||
    propLower.includes("name") ||
    propLower.includes("title")
  ) {
    return "200";
  } else if (
    propLower.includes("email") ||
    propLower.includes("phone") ||
    propLower.includes("status")
  ) {
    return "120";
  } else {
    return "100";
  }
}

module.exports = {
  generateAppRouteFile,
};

// Helper function to check if module has store (needs CRUD operations)
function hasStoreForModule(moduleName, swaggerJson) {
  const criteria = checkStoreRequirements(moduleName, swaggerJson);
  return criteria.hasList && (criteria.hasUpdate || criteria.hasDelete);
}

// Check if module has required operations for store generation
function checkStoreRequirements(moduleName, swaggerJson) {
  const paths = swaggerJson.paths || {};
  let hasList = false;
  let hasUpdate = false;
  let hasDelete = false;

  for (const [pathUrl, pathItem] of Object.entries(paths)) {
    const effectivePath = pathUrl.startsWith("/")
      ? pathUrl.substring(1)
      : pathUrl;
    const pathSegments = effectivePath.split("/");
    const relevantSegmentIndex = pathSegments.findIndex(
      (seg) => seg === moduleName
    );

    if (relevantSegmentIndex !== -1) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (["get", "post", "put", "delete"].includes(method)) {
          const httpMethod = method.toUpperCase();

          // Check for LIST operation (GET request returning arrays/collections)
          if (httpMethod === "GET") {
            // Consider it a list operation if it doesn't have path parameters (or has minimal path params)
            // or if the operationId contains 'list'
            const pathParams =
              operation.parameters?.filter((p) => p.in === "path") || [];
            const operationId = operation.operationId || "";

            if (
              pathParams.length === 0 ||
              operationId.toLowerCase().includes("list")
            ) {
              hasList = true;
            }
          }

          // Check for UPDATE operations (PUT/PATCH)
          if (httpMethod === "PUT" || httpMethod === "PATCH") {
            hasUpdate = true;
          }

          // Check for DELETE operations
          if (httpMethod === "DELETE") {
            hasDelete = true;
          }
        }
      }
    }
  }

  return { hasList, hasUpdate, hasDelete };
}

// Get appropriate hook name for listing operations
function getListHookName(moduleName, swaggerJson) {
  const modulePascalCase = capitalize(moduleName);

  // Find the first GET operation that looks like a list ( pagination or array response)
  const paths = swaggerJson.paths || {};
  for (const [path, operations] of Object.entries(paths)) {
    if (
      operations.get &&
      path.toLowerCase().includes(moduleName.toLowerCase())
    ) {
      const operationId = operations.get.operationId;
      if (operationId) {
        // Convert operationId to hook name format
        // e.g., "category_list" becomes "useCategoryList"
        const hookName =
          "use" +
          operationId
            .replace(/(_|\s)+/g, " ")
            .toLowerCase()
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join("");

        return hookName;
      }
    }
  }

  // Fallback to generic hook name
  return `use${modulePascalCase}List`;
}

// Capitalize helper function
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
