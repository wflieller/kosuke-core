-- Rename file_operations table to actions
ALTER TABLE "file_operations" RENAME TO "actions";

-- Rename the foreign key constraint
ALTER TABLE "actions" RENAME CONSTRAINT "file_operations_message_id_chat_messages_id_fk" TO "actions_message_id_chat_messages_id_fk"; 