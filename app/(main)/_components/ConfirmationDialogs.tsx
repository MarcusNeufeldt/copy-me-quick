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
    showSwitchConfirmDialog,
    showLoadRecentConfirmDialog,
    loadConfirmationMessage,
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
      <AlertDialog open={showSwitchConfirmDialog} onOpenChange={() => cancelTabSwitch()}>
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
      <AlertDialog open={showLoadRecentConfirmDialog} onOpenChange={() => cancelLoadRecent()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load Project?</AlertDialogTitle>
            <AlertDialogDescription>
              {loadConfirmationMessage}
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