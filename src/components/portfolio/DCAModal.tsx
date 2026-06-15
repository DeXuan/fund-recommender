import { Modal, Form, Input, InputNumber, DatePicker, Row, Col, Select, Spin } from 'antd';

interface Props {
  dcaModalOpen: boolean;
  editingDca: any | null;
  dcaForm: any;
  lookupLoading: boolean;
  onFundCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function DCAModal({
  dcaModalOpen, editingDca, dcaForm, lookupLoading,
  onFundCodeChange, onSubmit, onCancel,
}: Props) {
  return (
    <Modal
      title={editingDca ? '编辑定投计划' : '新建定投计划'}
      open={dcaModalOpen}
      onOk={onSubmit}
      onCancel={onCancel}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      width={520}
    >
      <Form form={dcaForm} layout="vertical" preserve={false}>
        <Form.Item
          name="fund_code"
          label="基金代码"
          rules={[{ required: true, message: '请输入基金代码' }]}
        >
          <Input placeholder="例如: 000961" maxLength={6} onChange={onFundCodeChange} />
        </Form.Item>
        <Form.Item
          name="fund_name"
          label="基金名称"
          rules={[{ required: true, message: '请输入基金名称' }]}
        >
          <Input
            placeholder="例如: 天弘沪深300ETF联接A"
            suffix={lookupLoading ? <Spin size="small" /> : undefined}
          />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="amount"
              label="每期定投金额(元)"
              rules={[{ required: true, message: '请输入金额' }]}
            >
              <InputNumber style={{ width: '100%' }} min={10} step={100} placeholder="1000" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="frequency"
              label="定投频率"
              rules={[{ required: true, message: '请选择频率' }]}
              initialValue="monthly"
            >
              <Select options={[
                { value: 'weekly', label: '每周' },
                { value: 'biweekly', label: '每两周' },
                { value: 'monthly', label: '每月' },
                { value: 'quarterly', label: '每季度' },
              ]} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.frequency !== cur.frequency}>
          {({ getFieldValue }) => {
            const freq = getFieldValue('frequency');
            return freq === 'weekly' || freq === 'biweekly' ? (
              <Form.Item name="day_of_week" label="每周几执行" initialValue={1}>
                <Select options={[
                  { value: 1, label: '周一' }, { value: 2, label: '周二' },
                  { value: 3, label: '周三' }, { value: 4, label: '周四' },
                  { value: 5, label: '周五' },
                ]} />
              </Form.Item>
            ) : (
              <Form.Item name="day_of_month" label="每月几号执行" initialValue={1}>
                <InputNumber style={{ width: '100%' }} min={1} max={28} placeholder="1" />
              </Form.Item>
            );
          }}
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="start_date"
              label="开始日期"
              rules={[{ required: true, message: '请选择开始日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="end_date" label="结束日期（选填）">
              <DatePicker style={{ width: '100%' }} placeholder="留空为长期" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={2} placeholder="选填，例如：支付宝定投" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
