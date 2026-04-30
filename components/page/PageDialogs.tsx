"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PageDialogsProps {
  showSwitchConfirmDialog: boolean;
  setShowSwitchConfirmDialog: (open: boolean) => void;
  confirmTabSwitch: () => void;
  cancelTabSwitch: () => void;
  showLoadRecentConfirmDialog: boolean;
  setShowLoadRecentConfirmDialog: (open: boolean) => void;
  loadConfirmationMessage: string;
  confirmLoadRecent: () => void;
  cancelLoadRecent: () => void;
}

export function PageDialogs({
  showSwitchConfirmDialog,
  setShowSwitchConfirmDialog,
  confirmTabSwitch,
  cancelTabSwitch,
  showLoadRecentConfirmDialog,
  setShowLoadRecentConfirmDialog,
  loadConfirmationMessage,
  confirmLoadRecent,
  cancelLoadRecent,
}: PageDialogsProps) {
  return (
    <>
      <AlertDialog open={showSwitchConfirmDialog} onOpenChange={setShowSwitchConfirmDialog}>
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

      <AlertDialog open={showLoadRecentConfirmDialog} onOpenChange={setShowLoadRecentConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load Project?</AlertDialogTitle>
            <AlertDialogDescription>
              {loadConfirmationMessage || 'Loading this project will replace your current session. Continue?'}
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
