const { ensureDirectoryExists } = require("../utils");
const { formatCode } = require("../utils");

// Function to generate Next.js app route file
async function generateAppRouteFile(moduleOutputDir, moduleName, swaggerJson) {
  const modulePaths = Object.keys(swaggerJson.paths);
  const resourcePaths = modulePaths.filter((path) => {
    const pathLower = path.toLowerCase();
    return (
      pathLower.includes(`/${moduleName.toLowerCase()}`) ||
      pathLower.includes(`/${moduleName.toLowerCase()}/`) ||
      (!pathLower.includes("/user/") &&
        !pathLower.includes("/store/") &&
        !pathLower.includes("/pet/"))
    );
  });

  if (resourcePaths.length === 0) {
    // If no specific paths found, use all paths for this module
    resourcePaths.push(...modulePaths);
  }

  const appDir = moduleOutputDir
    .replace("/modules/", "/app/")
    .replace(`/modules/${moduleName}`, `/${moduleName}`);
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
  const viewPath = `${appDir}/${moduleName}.view.tsx`;
  await require("fs").promises.writeFile(viewPath, viewContent);
  console.log(`Generated: ${viewPath}`);
}

// Generate Next.js page.tsx
function generatePageFile(moduleName, resourcePaths, swaggerJson) {
  const modulePascalCase =
    moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  const moduleCamelCase =
    moduleName.charAt(0).toLowerCase() + moduleName.slice(1);

  return `'use client';

import { Suspense } from 'react';
// import { ContactContextProvider } from './_viewModule/contacts.context';
import { ${modulePascalCase}View } from './${moduleCamelCase}.view';

export default function Page() {
  return (
    <Suspense
      fallback={
        <p style={{ textAlign: 'center' }}>loading... on initial request</p>
      }
    >
      <${modulePascalCase}View />
    </Suspense>
  );
}
`;
}

// Generate view component
function generateViewComponent(moduleName, resourcePaths, swaggerJson) {
  const moduleCamelCase =
    moduleName.charAt(0).toLowerCase() + moduleName.slice(1);
  const modulePascalCase =
    moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  const modelName = getModelNameFromSwagger(moduleName, swaggerJson);

  return `'use client';

import Link from 'next/link';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { Button, type TableColumnsType } from 'antd';
import { ContentEditableTable } from 'papak/kits/ContentEditableTable/default';
import { PageFilterInlineSearch } from '@/components/PageFilterInlineSearch';
import { ${modelName} } from '@/modules/${moduleName}/domains/models/${modelName}';
import { ${modulePascalCase}Presentation } from '@/modules/${moduleName}/${moduleCamelCase}.presentation';
import { ${moduleCamelCase}Store } from '@/modules/${moduleName}/${moduleCamelCase}.store';
import AddModal from './_components/AddModal';
import DeleteModal from './_components/DeleteModal';
import EditModal from './_components/EditModal';

export function ${modulePascalCase}View() {
  const { use${modulePascalCase}List } = ${modulePascalCase}Presentation();
  const getAll${modulePascalCase} = use${modulePascalCase}List();
  const data = getAll${modulePascalCase}.data?.data;

  const columns: TableColumnsType<${modelName}> = [
    ${generateTableColumns(modelName, resourcePaths, swaggerJson, moduleCamelCase)}
  ];

  return (
    <>
      <PageFilterInlineSearch
        searchBar={false}
        title={
          <div className='flex items-center gap-2'>
            <span>${modulePascalCase} Management</span>
          </div>
        }
        inlineFilter={() => (
          <div className='flex flex-1 items-center'>
            <div className='mr-auto flex gap-4'>
              <Link href={\`/dashboard/${moduleName}/add\`}>
                <Button className='mr-auto px-4 text-sm'>
                  Add Multiple ${modulePascalCase}
                </Button>
              </Link>
              <Button
                type='primary'
                className='mr-auto px-4 text-sm'
                onClick={() => {
                  ${moduleCamelCase}Store.setState({
                    addModalOpen: true,
                  });
                }}
              >
                New ${modulePascalCase}
              </Button>
            </div>
          </div>
        )}
      />
      <div>
        <ContentEditableTable<${modelName}>
          count={data?.count}
          data={data?.results || []}
          isPending={getAll${modulePascalCase}.isPending}
          columns={columns}
          rowKey='id'
          paginationPath={\`dashboard/${moduleName}\`}
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
  const definitions = swaggerJson.definitions || {};
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
function generateTableColumns(modelName, resourcePaths, swaggerJson) {
  const definitions = swaggerJson.definitions || {};
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
