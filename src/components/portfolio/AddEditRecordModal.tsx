import { Modal, Form, Input, InputNumber, DatePicker, Row, Col, Segmented, Spin } from 'antd';
import type { FundRecord } from '../../types';

interface Props {
  modalOpen: boolean;
  editingRecord: FundRecord | null;
  form: any;
  productType: 'fund' | 'cmb';
  lookupLoading: boolean;
  onFundCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  setProductType: (v: 'fund' | 'cmb') => void;
}

export function AddEditRecordModal({
  modalOpen, editingRecord, form, productType, lookupLoading,
  onFundCodeChange, onSubmit, onCancel, setProductType,
}: Props) {
  return (
    <Modal
      title={editingRecord ? '编辑持仓' : '添加持仓'}
      open={modalOpen}
      onOk={onSubmit}
      onCancel={onCancel}
      okText="保存"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item label="产品类型">
          <Segmented
            options={[
              { label: '基金', value: 'fund' },
              { label: '招行理财', value: 'cmb' },
            ]}
            value={productType}
            onChange={(val) => {
              setProductType(val as 'fund' | 'cmb');
              form.setFieldsValue({ fund_code: '', fund_name: '' });
            }}
          />
        </Form.Item>
        <Form.Item
          name="fund_code"
          label={productType === 'cmb' ? '产品代码' : '基金代码'}
          rules={[{ required: true, message: productType === 'cmb' ? '请输入产品代码' : '请输入基金代码' }]}
        >
          <Input
            placeholder={productType === 'cmb' ? '例如: PY040217' : '例如: 013349'}
            maxLength={productType === 'cmb' ? 20 : 6}
            onChange={onFundCodeChange}
          />
        </Form.Item>
        <Form.Item
          name="fund_name"
          label={productType === 'cmb' ? '产品名称' : '基金名称'}
          rules={[{ required: true, message: productType === 'cmb' ? '请输入产品名称' : '请输入基金名称' }]}
        >
          <Input
            placeholder={productType === 'cmb' ? '输入代码后自动填充' : '例如: 人工智能ETF联接A'}
            suffix={lookupLoading ? <Spin size="small" /> : undefined}
          />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="shares"
              label="持有份额"
              rules={[{ required: true, message: '请输入份额' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0.01} step={100} placeholder="1000" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="cost_price"
              label="成本价(元)"
              rules={[{ required: true, message: '请输入成本价' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0.0001} step={0.01} placeholder="1.2345" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="buy_date"
              label="买入日期"
              rules={[{ required: true, message: '请选择日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="buy_fee" label="手续费(元)" initialValue={0}>
              <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="0" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={2} placeholder="选填" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
