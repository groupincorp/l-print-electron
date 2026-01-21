import { LogOut } from "lucide-react";
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

      // Notify main process that token is removed
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
        <Button variant="default" size="sm" className="text-black ">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Logout</DialogTitle>
          <DialogDescription>
            Are you sure you want to logout?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <div className="flex flex-row gap-2">
              <Button
                variant="destructive"
                onClick={async () => handleLogout(true)}
                className="text-black "
              >
                Logout & Reset Server
              </Button>
              <Button
                onClick={async () => handleLogout(false)}
                className="text-black "
              >
                Logout
              </Button>
            </div>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
