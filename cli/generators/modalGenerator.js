const { ensureDirectoryExists } = require("../utils");

async function generateModalComponents(
  moduleOutputDir,
  moduleName,
  swaggerJson
) {
  const moduleCamelCase =
    moduleName.charAt(0).toLowerCase() + moduleName.slice(1);
  const modulePascalCase =
    moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

  const componentsDir = moduleOutputDir
    .replace("/modules/", "/app/")
    .replace(`/modules/${moduleName}`, `/${moduleName}`);
  await ensureDirectoryExists(componentsDir);

  const modalsSubDir = `${componentsDir}/_components`;
  await ensureDirectoryExists(modalsSubDir);

  // Generate AddModal
  const addModalContent = generateAddModal(
    moduleName,
    moduleCamelCase,
    modulePascalCase,
    swaggerJson
  );
  const addModalPath = `${modalsSubDir}/AddModal.tsx`;
  await require("fs").promises.writeFile(addModalPath, addModalContent);
  console.log(`Generated: ${addModalPath}`);

  // Generate EditModal
  const editModalContent = generateEditModal(
    moduleName,
    moduleCamelCase,
    modulePascalCase,
    swaggerJson
  );
  const editModalPath = `${modalsSubDir}/EditModal.tsx`;
  await require("fs").promises.writeFile(editModalPath, editModalContent);
  console.log(`Generated: ${editModalPath}`);

  // Generate DeleteModal
  const deleteModalContent = generateDeleteModal(
    moduleName,
    moduleCamelCase,
    modulePascalCase,
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
  moduleName,
  moduleCamelCase,
  modulePascalCase,
  swaggerJson
) {
  return `import React from 'react';
import { Form, Input, Select } from 'antd';
import { convertToEnglishNumbers } from 'papak/utils/convertToEnglishNumbers';
import { CustomModal } from '@/components/CustomModal';
import { ${modulePascalCase}Presentation } from '@/modules/${moduleName}/${moduleCamelCase}.presentation';
import { ${moduleCamelCase}Store } from '@/modules/${moduleName}/${moduleCamelCase}.store';
import { Footer } from './ModalFooter';

const AddModal: React.FC = () => {
  const { use${modulePascalCase}Create } = ${modulePascalCase}Presentation();
  const [{ addModalOpen }, updateValues] = ${moduleCamelCase}Store.useStoreKeys([
    'addModalOpen',
  ]);

  const [form] = Form.useForm();

  const { isPending, mutate } = use${modulePascalCase}Create(form);

  const closeHandler = () =>
    updateValues({
      addModalOpen: false,
    });

  return (
    <CustomModal
      width={640}
      title='افزودن ${modulePascalCase} جدید'
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
          <Form.Item name='category_title' label='عنوان ${modulePascalCase}'>
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
  moduleName,
  moduleCamelCase,
  modulePascalCase,
  swaggerJson
) {
  return `import React from 'react';
import { Form, Input } from 'antd';
import { convertToEnglishNumbers } from 'papak/utils/convertToEnglishNumbers';
import { CustomModal } from '@/components/CustomModal';
import { ${modulePascalCase}Presentation } from '@/modules/${moduleName}/${moduleCamelCase}.presentation';
import { ${moduleCamelCase}Store } from '@/modules/${moduleName}/${moduleCamelCase}.store';
import { useInitForm } from '@/utils/formHandler';
import { Footer } from './ModalFooter';

const EditModal: React.FC = () => {
  const [form] = Form.useForm();
  const [{ selectedRowState, editModalOpen }, updateValues] =
    ${moduleCamelCase}Store.useStoreKeys(['selectedRowState', 'editModalOpen']);
  const { use${modulePascalCase}Update } = ${modulePascalCase}Presentation();

  const initData = selectedRowState[0];

  const { isPending, mutate } = use${modulePascalCase}Update(form);

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
      title='ویرایش ${modulePascalCase}'
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
          <Form.Item name='category_title' label='عنوان ${modulePascalCase}'>
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
  moduleName,
  moduleCamelCase,
  modulePascalCase,
  swaggerJson
) {
  return `import React from 'react';
import { ConfirmModal } from 'papak/kits/ConfirmModal';
import { ${modulePascalCase}Presentation } from '@/modules/${moduleName}/${moduleCamelCase}.presentation';
import { ${moduleCamelCase}Store } from '@/modules/${moduleName}/${moduleCamelCase}.store';

const DeleteModal: React.FC = () => {
  const [{ deleteModalOpen, selectedRowState }, updateValues] =
    ${moduleCamelCase}Store.useStoreKeys(['deleteModalOpen', 'selectedRowState']);

  const { use${modulePascalCase}Destroy } = ${modulePascalCase}Presentation();

  const { isPending, mutate } = use${modulePascalCase}Destroy();

  const closeHandler = () =>
    updateValues({
      deleteModalOpen: false,
    });

  return (
    <ConfirmModal
      open={deleteModalOpen}
      key='delete-${moduleCamelCase}'
      isPending={isPending}
      title='حذف ${modulePascalCase}'
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
