const {
  ensureDirectoryExists,
  formatCode,
  NamingStrategy,
} = require("../utils");

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

// Helper function to check if module has store (needs CRUD operations)
function hasStoreForModule(moduleName, swaggerJson) {
  const criteria = checkStoreRequirements(moduleName, swaggerJson);
  return criteria.hasList && (criteria.hasUpdate || criteria.hasDelete);
}

async function generateModalComponents(
  moduleOutputDir,
  moduleName,
  swaggerJson
) {
  // Skip modal generation for modules without stores (read-only modules)
  if (!hasStoreForModule(moduleName, swaggerJson)) {
    console.log(
      `Skipping modal generation for read-only module: ${moduleName}`
    );
    return;
  }

  // Use NamingStrategy for consistent naming
  const { basePascalName, baseCamelName, fileName } =
    NamingStrategy.getBaseNames(moduleName);
  const presentationName = NamingStrategy.presentationName(basePascalName);
  const storeName = NamingStrategy.storeName(baseCamelName);

  // Find main CRUD hooks for this module
  const crudHooks = findMainCRUDHooks(basePascalName, swaggerJson, moduleName);

  const componentsDir = moduleOutputDir
    .replace("/modules/", "/app/")
    .replace(`/modules/${moduleName}`, `/${moduleName}`);
  await ensureDirectoryExists(componentsDir);

  const modalsSubDir = `${componentsDir}/_components`;
  await ensureDirectoryExists(modalsSubDir);

  // Generate AddModal
  const addModalContent = generateAddModal(
    basePascalName,
    presentationName,
    storeName,
    fileName,
    crudHooks,
    swaggerJson
  );
  const addModalPath = `${modalsSubDir}/AddModal.tsx`;
  await require("fs").promises.writeFile(addModalPath, addModalContent);
  console.log(`Generated: ${addModalPath}`);

  // Generate EditModal
  const editModalContent = generateEditModal(
    basePascalName,
    presentationName,
    storeName,
    fileName,
    crudHooks,
    swaggerJson
  );
  const editModalPath = `${modalsSubDir}/EditModal.tsx`;
  await require("fs").promises.writeFile(editModalPath, editModalContent);
  console.log(`Generated: ${editModalPath}`);

  // Generate DeleteModal
  const deleteModalContent = generateDeleteModal(
    basePascalName,
    presentationName,
    storeName,
    fileName,
    crudHooks,
    swaggerJson
  );
  const deleteModalPath = `${modalsSubDir}/DeleteModal.tsx`;
  await require("fs").promises.writeFile(deleteModalPath, deleteModalContent);
  console.log(`Generated: ${deleteModalPath}`);

  // Generate ModalFooter
  const modalFooterContent = generateModalFooter(moduleName, swaggerJson);
  const modalFooterPath = `${modalsSubDir}/ModalFooter.tsx`;
  await require("fs").promises.writeFile(modalFooterPath, modalFooterContent);
  console.log(`Generated: ${modalFooterPath}`);
}

function generateAddModal(
  basePascalName,
  presentationName,
  storeName,
  fileName,
  crudHooks,
  swaggerJson
) {
  return `import React from 'react';
import { Form, Input, Select } from 'antd';
import { convertToEnglishNumbers } from 'papak/utils/convertToEnglishNumbers';
import { CustomModal } from '@/components/CustomModal';
import { ${presentationName} } from '@/modules/${fileName}/${fileName}.presentation';
import { ${storeName} } from '@/modules/${fileName}/${fileName}.store';
import { Footer } from './ModalFooter';

const AddModal: React.FC = () => {
  const { ${crudHooks.create} } = ${presentationName}();
  const [{ addModalOpen }, updateValues] = ${storeName}.useStoreKeys([
    'addModalOpen',
  ]);

  const [form] = Form.useForm();

  const { isPending, mutate } = ${crudHooks.create}();

  const closeHandler = () =>
    updateValues({
      addModalOpen: false,
    });

  return (
    <CustomModal
      width={640}
      title='افزودن ${basePascalName} جدید'
      open={addModalOpen}
      closeHandler={closeHandler}
      form={form}
    >
      <Form
        form={form}
        layout='vertical'
        onFinish={formData => mutate(formData)}
        autoComplete='off'
      >
        <div className='grid grid-cols-2 gap-4'>
          <Form.Item
            label='شناسه'
            name='id'
            normalize={value => convertToEnglishNumbers(value)}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name='category_title' label='عنوان ${basePascalName}'>
            <Input />
          </Form.Item>
        </div>

        <Footer
          isPending={isPending}
          closeHandler={closeHandler}
          primaryTitle='ثبت'
          secondaryTitle='انصراف'
        >
          {/* Add additional controls here if needed */}
        </Footer>
      </Form>
    </CustomModal>
  );
};

export default AddModal;
`;
}

function generateEditModal(
  basePascalName,
  presentationName,
  storeName,
  fileName,
  crudHooks,
  swaggerJson
) {
  return `import React from 'react';
import { Form, Input } from 'antd';
import { convertToEnglishNumbers } from 'papak/utils/convertToEnglishNumbers';
import { CustomModal } from '@/components/CustomModal';
import { ${presentationName} } from '@/modules/${fileName}/${fileName}.presentation';
import { ${storeName} } from '@/modules/${fileName}/${fileName}.store';
import { useInitForm } from '@/utils/formHandler';
import { Footer } from './ModalFooter';

const EditModal: React.FC = () => {
  const [form] = Form.useForm();
  const [{ selectedRowState, editModalOpen }, updateValues] =
    ${storeName}.useStoreKeys(['selectedRowState', 'editModalOpen']);
  const { ${crudHooks.update} } = ${presentationName}();

  const initData = selectedRowState[0];

  const { isPending, mutate } = ${crudHooks.update}(form);

  const closeHandler = () =>
    updateValues({
      editModalOpen: false,
    });

  useInitForm({
    form,
    initData,
  });

  return (
    <CustomModal
      width={640}
      title='ویرایش ${basePascalName}'
      open={editModalOpen}
      closeHandler={closeHandler}
      form={form}
    >
      <Form
        form={form}
        layout='vertical'
        onFinish={formData => mutate({ body: formData, id: initData?.id })}
        autoComplete='off'
      >
        <div className='grid grid-cols-2 gap-4'>
          <Form.Item
            label='شناسه'
            name='id'
            normalize={value => convertToEnglishNumbers(value)}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name='category_title' label='عنوان ${basePascalName}'>
            <Input />
          </Form.Item>
        </div>

        <Footer
          isPending={isPending}
          closeHandler={closeHandler}
          primaryTitle='ثبت'
          secondaryTitle='انصراف'
        />
      </Form>
    </CustomModal>
  );
};

export default EditModal;
`;
}

function generateDeleteModal(
  basePascalName,
  presentationName,
  storeName,
  fileName,
  crudHooks,
  swaggerJson
) {
  return `import React from 'react';
import { ConfirmModal } from 'papak/kits/ConfirmModal';
import { ${presentationName} } from '@/modules/${fileName}/${fileName}.presentation';
import { ${storeName} } from '@/modules/${fileName}/${fileName}.store';

const DeleteModal: React.FC = () => {
  const [{ deleteModalOpen, selectedRowState }, updateValues] =
    ${storeName}.useStoreKeys(['deleteModalOpen', 'selectedRowState']);

  const { ${crudHooks.delete} } = ${presentationName}();

  const { isPending, mutate } = ${crudHooks.delete}();

  const closeHandler = () =>
    updateValues({
      deleteModalOpen: false,
    });

  return (
    <ConfirmModal
      open={deleteModalOpen}
      key='delete-${fileName}'
      isPending={isPending}
      title='حذف ${basePascalName}'
      content='آیا برای حذف این مورد مطمئن هستید؟'
      handleCancel={closeHandler}
      handleOk={() => mutate({ id: selectedRowState[0]?.id })}
      confirmText='بله، حذف شود.'
      cancelText='انصراف'
    />
  );
};

export default DeleteModal;
`;
}

function generateModalFooter(moduleName, swaggerJson) {
  return `import React from 'react';
import { Button } from 'antd';

export const Footer: React.FC<{
  isPending: boolean;
  closeHandler: () => void;
  primaryTitle: string;
  secondaryTitle: string;
  children?: React.ReactNode;
}> = ({ isPending, closeHandler, primaryTitle, secondaryTitle, children }) => {
  return (
    <div className='flex justify-end gap-2 pt-4'>
      {children}
      <Button disabled={isPending} onClick={closeHandler}>
        {secondaryTitle}
      </Button>
      <Button type='primary' htmlType='submit' loading={isPending}>
        {primaryTitle}
      </Button>
    </div>
  );
};
`;
}

function findMainCRUDHooks(basePascalName, swaggerJson, moduleName) {
  // For now, use simple heuristic: prefer "Image" operations for docker-image module
  // This could be made more sophisticated by analyzing the swagger operations

  const preferredEntity = "Image"; // Could be configurable

  return {
    create: `use${basePascalName}${preferredEntity}create`,
    update: `use${basePascalName}${preferredEntity}update`,
    delete: `use${basePascalName}${preferredEntity}delete`,
  };
}

function getModelNameFromSwagger(swaggerJson) {
  const definitions = swaggerJson.definitions || {};
  const definitionKeys = Object.keys(definitions);

  // Use the first definition as the main model
  const mainModel = definitionKeys.length > 0 ? definitionKeys[0] : null;

  return mainModel || "Entity";
}

module.exports = {
  generateModalComponents,
};
