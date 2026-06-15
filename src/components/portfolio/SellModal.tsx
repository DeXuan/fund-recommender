import { Modal, Form, Input, InputNumber, DatePicker, Alert } from 'antd';
import type { PortfolioHolding } from '../../types';

interface Props {
  sellModalOpen: boolean;
  sellTarget: PortfolioHolding | null;
  sellForm: any;
  sellLoading: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function SellModal({ sellModalOpen, sellTarget, sellForm, sellLoading, onSubmit, onCancel }: Props) {
  return (
    <Modal title={`赎回 - ${sellTarget?.fund_name || ''}`} open={sellModalOpen} onCancel={onCancel}
      onOk={onSubmit} confirmLoading={sellLoading} okText="确认赎回" okButtonProps={{ danger: true }} width={500}>
      {sellTarget && (
        <>
          <Alert
            message={`持有 ${sellTarget.total_shares.toFixed(4)} 份，成本价 ¥${sellTarget.avg_cost_price.toFixed(4)}，当前净值 ¥${(sellTarget.current_nav || 0).toFixed(4)}`}
            type="info" showIcon style={{ marginBottom: 16 }}
          />
          <Form form={sellForm} layout="vertical" initialValues={{
            sell_price: sellTarget.current_nav || undefined,
            sell_date: undefined,
            shares: undefined,
          }}>
            <Form.Item name="shares" label="赎回份额" rules={[{ required: true, message: '请输入赎回份额' }, { validator: (_, v) => v > 0 && v <= (sellTarget?.total_shares || 0) ? Promise.resolve() : Promise.reject(new Error(`份额需在0-${sellTarget?.total_shares?.toFixed(4)}之间`)) }]}>
              <InputNumber style={{ width: '100%' }} min={0.0001} max={sellTarget.total_shares} step={100} placeholder={`最大可赎${sellTarget.total_shares.toFixed(4)}份`} />
            </Form.Item>
            <Form.Item name="sell_price" label="卖出净值" rules={[{ required: true, message: '请输入卖出净值' }]}>
              <InputNumber style={{ width: '100%' }} min={0.0001} step={0.001} precision={4} />
            </Form.Item>
            <Form.Item name="sell_date" label="卖出日期" rules={[{ required: true, message: '请选择卖出日期' }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="sell_fee" label="卖出手续费">
              <InputNumber style={{ width: '100%' }} min={0} step={1} precision={2} placeholder="可选" />
            </Form.Item>
            <Form.Item name="notes" label="备注">
              <Input.TextArea rows={2} placeholder="可选" />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
}
