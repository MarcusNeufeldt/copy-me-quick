'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppContext } from '../_context/AppContext';

export function ConfirmationDialogs() {
  const { 
    ui,
    actions: { 
      confirmTabSwitch, 
      cancelTabSwitch, 
      confirmLoadRecent, 
      cancelLoadRecent 
    }
  } = useAppContext();

  return (
    <>
      {/* Tab Switch Confirmation Dialog */}
      <AlertDialog open={ui.showSwitchConfirmDialog} onOpenChange={() => cancelTabSwitch()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Source Switch</AlertDialogTitle>
            <AlertDialogDescription>
              Switching sources will change your current view. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelTabSwitch}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTabSwitch}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Load Project Confirmation Dialog */}
      <AlertDialog open={ui.showLoadRecentConfirmDialog} onOpenChange={() => cancelLoadRecent()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load Project?</AlertDialogTitle>
            <AlertDialogDescription>
              {ui.loadConfirmationMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLoadRecent}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLoadRecent}>Load Project</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}