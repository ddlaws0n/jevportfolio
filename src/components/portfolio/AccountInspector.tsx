import { X } from "lucide-react";

import { Drawer } from "#/components/motion/drawer";
import { Loader } from "#/components/motion/loader";
import {
	AccountDetailBody,
	AccountDetailHeader,
} from "#/components/portfolio/AccountDetail";
import type { TriagedAccount } from "#/lib/portfolio/types";

export function AccountInspector({
	row,
	loading,
	open,
	onClose,
}: {
	row: TriagedAccount | null;
	loading: boolean;
	open: boolean;
	onClose: () => void;
}) {
	return (
		<Drawer
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			side="right"
			ariaLabel="Account inspector"
			className="w-full max-w-[520px] border-l border-border bg-background"
		>
			<div className="flex h-full flex-col">
				<div className="flex items-center justify-between border-b border-border px-5 py-3">
					<span className="label-caps">Account inspector</span>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close inspector"
						className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto px-5 py-5">
					{row ? (
						<div className="space-y-8">
							<AccountDetailHeader row={row} showLink />
							<AccountDetailBody row={row} />
						</div>
					) : loading ? (
						<div className="flex h-40 items-center justify-center">
							<Loader variant="ascii" label="Loading account" />
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							That account is not in the recorded run.
						</p>
					)}
				</div>
			</div>
		</Drawer>
	);
}
