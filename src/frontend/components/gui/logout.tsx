import { LogOut, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

export function Logout() {
  const handleLogout = async (resetServer = false) => {
    try {
      localStorage.removeItem("token");
      if (resetServer) {
        localStorage.removeItem("server-endpoint");
        localStorage.removeItem("server-target");
      }
      if (backend.tokenChanged) {
        await backend.tokenChanged(null);
      }
      window.location.reload();
    } catch (error) {
      console.error("Failed to logout:", error);
      window.location.reload();
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-[12px] gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/20 flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-[15px] font-semibold">
              Sign out
            </DialogTitle>
          </div>
          <DialogDescription className="text-[13px] text-muted-foreground pl-0">
            Are you sure you want to sign out of Printer Manager?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="text-[12px] h-8">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLogout(true)}
              className="text-[12px] h-8 border-destructive/30 text-destructive hover:bg-destructive/5"
            >
              Reset &amp; Sign out
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              size="sm"
              onClick={() => handleLogout(false)}
              className="text-[12px] h-8"
            >
              Sign out
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
