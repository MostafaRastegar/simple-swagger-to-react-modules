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
  const moduleCamelCase =
    moduleName.charAt(0).toLowerCase() + moduleName.slice(1);

  return `'use client';

import { Suspense } from 'react';
// import { ContactContextProvider } from './_viewModule/contacts.context';
import { ${moduleCamelCase}View } from './${moduleCamelCase}.view';

export default function Page() {
  return (
    <Suspense
      fallback={
        <p style={{ textAlign: 'center' }}>loading... on initial request</p>
      }
    >
      <${moduleCamelCase}View />
    </Suspense>
  );
}
`;
}

// Generate view component
function generateViewComponent(moduleName, resourcePaths, swaggerJson) {
  const moduleCamelCase =
    moduleName.charAt(0).toLowerCase() + moduleName.slice(1);
  const modelName = getModelNameFromSwagger(swaggerJson);

  return `'use client';

import Link from 'next/link';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { Button, type TableColumnsType } from 'antd';
import { ContentEditableTable } from 'papak/kits/ContentEditableTable/default';
import { PageFilterInlineSearch } from '@/components/PageFilterInlineSearch';
import { ${modelName} } from '@/modules/${moduleName}/domains/models/${modelName}';
import { ${moduleCamelCase}Presentation } from '@/modules/${moduleName}/${moduleCamelCase}.presentation';
import { ${moduleCamelCase}Store } from '@/modules/${moduleName}/${moduleCamelCase}.store';
import AddModal from './_components/AddModal';
import DeleteModal from './_components/DeleteModal';
import EditModal from './_components/EditModal';

export function ${moduleCamelCase}View() {
  const { use${moduleName}List } = ${moduleCamelCase}Presentation();
  const getAll${moduleName} = use${moduleName}List();
  const data = getAll${moduleName}.data?.data;

  const columns: TableColumnsType<${modelName}> = [
    ${generateTableColumns(modelName, resourcePaths, swaggerJson)}
  ];

  return (
    <>
      <PageFilterInlineSearch
        searchBar={false}
        title={
          <div className='flex items-center gap-2'>
            <span>${moduleName} Management</span>
          </div>
        }
        inlineFilter={() => (
          <div className='flex flex-1 items-center'>
            <div className='mr-auto flex gap-4'>
              <Link href={\`/dashboard/${moduleName}/add\`}>
                <Button className='mr-auto px-4 text-sm'>
                  Add Multiple ${moduleName}
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
                New ${moduleName}
              </Button>
            </div>
          </div>
        )}
      />
      <div>
        <ContentEditableTable<${modelName}>
          count={data?.count}
          data={data?.results || []}
          isPending={getAll${moduleName}.isPending}
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
function getModelNameFromSwagger(swaggerJson) {
  const definitions = swaggerJson.definitions || {};
  const definitionKeys = Object.keys(definitions);

  // Find main model for the module
  const mainModel = definitionKeys.find((key) => {
    const keyLower = key.toLowerCase();
    return (
      keyLower.includes("pet") ||
      keyLower.includes("user") ||
      keyLower.includes("order") ||
      keyLower === key.toLowerCase()
    );
  });

  return mainModel || "Entity";
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
      dataIndex: 'actions',
      key: 'actions',
      width: 50,
      render(_, record) {
        return (
          <span className='flex items-center gap-4'>
            <IconEdit
              onClick={() => {
                ${modelName.toLowerCase()}Store.setState({
                  selectedRowState: [record],
                  editModalOpen: true,
                });
              }}
              className='cursor-pointer text-gray-700'
            />
            <IconTrash
              onClick={() => {
                ${modelName.toLowerCase()}Store.setState({
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
