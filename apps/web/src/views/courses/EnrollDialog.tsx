import { Link } from "@tanstack/react-router";
import { Button } from "@job-hunt/ui/components/button";
import { DialogShell } from "@job-hunt/ui/components/dialog-shell";
import { formatPrice } from "@entities/course";

interface EnrollDialogProps {
  open: boolean;
  onClose: () => void;
  courseTitle: string;
  priceCents: number;
  /** 游客：先引导登录（登录后可能已被开通） */
  guest: boolean;
  /** 登录跳转后回到的页面 */
  redirectTo: string;
}

/** 锁定课程 / 非试看课时的开通提示。文案见 spec §5。 */
export function EnrollDialog({ open, onClose, courseTitle, priceCents, guest, redirectTo }: EnrollDialogProps) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="开通课程"
      footer={
        <>
          <Button onClick={onClose}>知道了</Button>
          {guest && (
            <Button asChild variant="primary">
              <Link to="/login" search={{ redirect: redirectTo }}>
                先登录
              </Link>
            </Button>
          )}
        </>
      }
    >
      <p className="text-sm">
        <span className="font-medium">{courseTitle}</span>
        <span className="ml-2 text-accent-700">{formatPrice(priceCents)}</span>
      </p>
      <p className="mt-3 text-sm leading-relaxed text-neutral-700">
        公司注册中，暂时通过微信联系开通：<b>（待填写）</b>；开通后刷新本页。
      </p>
      {guest && (
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">已经开通过？请先登录，权益会关联到你的手机号。</p>
      )}
    </DialogShell>
  );
}
