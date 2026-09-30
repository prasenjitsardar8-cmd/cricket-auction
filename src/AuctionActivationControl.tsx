import {
  useCallback,
  useEffect,
  useState,
} from "react";

import "./AuctionActivationControl.css";

import { supabase } from "./supabase";

type ProjectorStateRow = {
  id: number;
  auction_active: boolean | null;
};

function AuctionActivationControl() {
  const [
    auctionActive,
    setAuctionActive,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const loadState =
    useCallback(
      async () => {
        try {
          const {
            data,
            error,
          } =
            await supabase
              .from(
                "projector_sync_state"
              )
              .select(
                "id, auction_active"
              )
              .eq(
                "id",
                1
              )
              .maybeSingle();

          if (error) {
            throw error;
          }

          setAuctionActive(
            data?.auction_active === true
          );

          setErrorMessage("");
        } catch (error) {
          console.error(
            "AUCTION ACTIVE STATE LOAD ERROR",
            error
          );

          setErrorMessage(
            "Unable to read auction status"
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    void loadState();

    const channel =
      supabase
        .channel(
          "auction-active-admin"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "projector_sync_state",
            filter:
              "id=eq.1",
          },
          (
            payload
          ) => {
            const row =
              payload.new as
                | ProjectorStateRow
                | undefined;

            if (
              row &&
              row.id === 1
            ) {
              setAuctionActive(
                row.auction_active ===
                  true
              );
            } else {
              void loadState();
            }
          }
        )
        .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [loadState]);

  const toggleAuction =
    async () => {
      const nextActive =
        !auctionActive;

      const confirmationText =
        nextActive
          ? "Activate the auction? The projector will immediately move to the live auction screen."
          : "Deactivate the auction? All projector screens will immediately return to the Welcome screen and remain locked there.";

      if (
        !window.confirm(
          confirmationText
        )
      ) {
        return;
      }

      try {
        setSaving(true);
        setErrorMessage("");

        const {
          error,
        } =
          await supabase.rpc(
            "set_auction_active",
            {
              p_active:
                nextActive,
            }
          );

        if (error) {
          throw error;
        }

        setAuctionActive(
          nextActive
        );
      } catch (error) {
        console.error(
          "AUCTION ACTIVE STATE WRITE ERROR",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to update auction status"
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <div
      className={[
        "auction-activation-control",
        auctionActive
          ? "active"
          : "inactive",
      ].join(" ")}
      title={
        errorMessage ||
        (
          auctionActive
            ? "Auction is active"
            : "Auction is locked on the Welcome screen"
        )
      }
    >
      <span
        className="auction-activation-status-dot"
      />

      <div className="auction-activation-copy">
        <span>
          AUCTION
        </span>

        <strong>
          {loading
            ? "CHECKING..."
            : auctionActive
            ? "ACTIVE"
            : "INACTIVE"}
        </strong>
      </div>

      <button
        type="button"
        disabled={
          loading ||
          saving ||
          Boolean(
            errorMessage &&
            loading
          )
        }
        onClick={() =>
          void toggleAuction()
        }
      >
        {saving
          ? "UPDATING..."
          : auctionActive
          ? "MAKE INACTIVE"
          : "MAKE ACTIVE"}
      </button>
    </div>
  );
}

export default AuctionActivationControl;
