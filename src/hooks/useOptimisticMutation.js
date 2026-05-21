/**
 * useOptimisticMutation — thin wrapper around useMutation that adds
 * optimistic UI (instant cache update + rollback on error).
 *
 * @param {Function} mutationFn   - The async function that performs the actual API call.
 * @param {Object}   options
 * @param {import('@tanstack/react-query').QueryClient} options.queryClient
 * @param {Array}    options.queryKey      - The React Query key to optimistically update.
 * @param {Function} options.updater       - (oldData, variables) => newData
 *                                           Applied optimistically before the server responds.
 * @param {Function} [options.onSuccess]   - Called after a confirmed server success.
 * @param {Function} [options.onError]     - Called after rollback (in addition to automatic rollback).
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 *
 * Example:
 *   const addMsg = useOptimisticMutation(
 *     (data) => base44.entities.Message.create(data),
 *     {
 *       queryClient,
 *       queryKey: ["messages", channelId],
 *       updater: (old, newMsg) => [...old, { ...newMsg, id: "temp-" + Date.now() }],
 *       onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages", channelId] }),
 *     }
 *   );
 */
import { useMutation } from "@tanstack/react-query";

export function useOptimisticMutation(mutationFn, options = {}) {
  const { queryClient, queryKey, updater, onSuccess, onError } = options;

  return useMutation({
    mutationFn,

    onMutate: async (variables) => {
      if (!queryClient || !queryKey || !updater) return {};

      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData(queryKey);

      // Apply the optimistic update
      queryClient.setQueryData(queryKey, (old) =>
        updater(old ?? [], variables)
      );

      return { previousData };
    },

    onError: (err, variables, context) => {
      // Roll back to the snapshot
      if (queryClient && queryKey && context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      onError?.(err, variables, context);
    },

    onSuccess: (data, variables, context) => {
      // Always re-sync with server after confirmed mutation to prevent stale cache
      if (queryClient && queryKey) {
        queryClient.invalidateQueries({ queryKey });
      }
      onSuccess?.(data, variables, context);
    },
  });
}

export default useOptimisticMutation;